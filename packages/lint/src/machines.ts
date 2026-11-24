import type { AnyStateMachine, AnyStateNode } from "xstate";
import { GENERATED_END, MACHINES_END, MACHINES_START, withBlock } from "./timeline-doc.ts";

/**
 * Structural checks for an XState v5 machine, so every flow stays easy to test and to draw:
 * - every state can be reached from the start;
 * - no state is a trap: each one is final, or can still reach the start (the initial state, or
 *   where its eventless transitions settle) or a final state;
 * - the initial state invokes nothing, so the machine is safe to start during server render.
 */
export interface MachineProblem {
  readonly state: string;
  readonly message: string;
}

type Edge = { readonly from: AnyStateNode; readonly to: AnyStateNode; readonly label: string };

const children = (node: AnyStateNode): ReadonlyArray<AnyStateNode> => Object.values(node.states);

const descendants = (node: AnyStateNode): ReadonlyArray<AnyStateNode> =>
  children(node).flatMap((child) => [child, ...descendants(child)]);

const initialTargets = (node: AnyStateNode): ReadonlyArray<AnyStateNode> =>
  node.type === "parallel" ? children(node) : (node.initial?.target ?? []);

/** Where entering a history state lands when nothing is remembered yet: its target, or the parent's start. */
const historyTargets = (node: AnyStateNode): ReadonlyArray<AnyStateNode> => {
  const parent = node.parent as AnyStateNode;
  const targets = [node.config.target ?? []].flat() as ReadonlyArray<string>;
  if (!targets.length) return parent.type === "parallel" ? [parent] : initialTargets(parent);
  return targets.map((t) =>
    t.startsWith("#")
      ? node.machine.getStateNodeById(t.slice(1))
      : t.split(".").reduce((n: AnyStateNode, key) => n.states[key] as AnyStateNode, parent),
  );
};

/**
 * The node plus whatever entering it also enters: initial children, every region of a parallel
 * state, or a history state's default target.
 */
const entered = (node: AnyStateNode): ReadonlyArray<AnyStateNode> =>
  node.type === "history"
    ? [node, ...historyTargets(node).flatMap(entered)]
    : [node, ...initialTargets(node).flatMap(entered)];

const label = (eventType: string) => {
  if (eventType.startsWith("xstate.done.actor.")) return `done: ${eventType.slice(18)}`;
  if (eventType.startsWith("xstate.error.actor.")) return `error: ${eventType.slice(19)}`;
  if (eventType.startsWith("xstate.after.")) return "after";
  return eventType;
};

/** Transitions defined on a node itself: events, eventless and delayed ones. */
export const edgesOf = (node: AnyStateNode): ReadonlyArray<Edge> => {
  const out: Array<Edge> = [];
  for (const [eventType, transitions] of Object.entries(node.on ?? {})) {
    for (const t of transitions as ReadonlyArray<{ target?: ReadonlyArray<AnyStateNode> }>) {
      for (const to of t.target ?? []) out.push({ from: node, to, label: label(eventType) });
    }
  }
  for (const t of node.always ?? [])
    for (const to of t.target ?? []) out.push({ from: node, to, label: "always" });
  return out;
};

const ancestors = (node: AnyStateNode): ReadonlyArray<AnyStateNode> =>
  node.parent ? [node.parent, ...ancestors(node.parent)] : [];

/** A parallel state's onDone: it fires only once every region is final, so it is no way out of one. */
const isParallelDone = (e: Edge) =>
  e.from.type === "parallel" && e.label.startsWith("xstate.done.state.");

/**
 * Where a node can go next: its own transitions and those inherited from its ancestors. With
 * `inRegion`, a parallel state's onDone does not count.
 */
const next = (node: AnyStateNode, inRegion = false): ReadonlyArray<AnyStateNode> =>
  [node, ...ancestors(node)]
    .flatMap(edgesOf)
    .filter((e) => !(inRegion && isParallelDone(e)))
    .flatMap((e) => entered(e.to));

const reachableFrom = (
  starts: ReadonlyArray<AnyStateNode>,
  inRegion = false,
): Set<AnyStateNode> => {
  const seen = new Set<AnyStateNode>();
  const queue = [...starts];
  while (queue.length) {
    const node = queue.shift() as AnyStateNode;
    if (seen.has(node)) continue;
    seen.add(node);
    queue.push(...next(node, inRegion), ...initialTargets(node));
  }
  return seen;
};

const isFinal = (node: AnyStateNode) => node.type === "final";
const name = (node: AnyStateNode) => node.path.join(".") || "(root)";

/** The initial states plus wherever their eventless (`always`) transitions settle. */
const settled = (nodes: ReadonlyArray<AnyStateNode>): ReadonlyArray<AnyStateNode> => {
  const out = new Set<AnyStateNode>();
  const queue = nodes.flatMap(entered);
  while (queue.length) {
    const node = queue.shift() as AnyStateNode;
    if (out.has(node)) continue;
    out.add(node);
    for (const edge of edgesOf(node)) if (edge.label === "always") queue.push(...entered(edge.to));
  }
  return [...out];
};

export const checkMachine = (machine: AnyStateMachine): ReadonlyArray<MachineProblem> => {
  const problems: Array<MachineProblem> = [];
  const root = machine.root;
  const all = descendants(root);
  const initial = initialTargets(root);
  const start = settled(initial);
  const reached = reachableFrom(initial.flatMap(entered));
  // A state is active whenever a state inside it is, e.g. after a transition straight to a child.
  const reachable = new Set([...reached].flatMap((n) => [n, ...ancestors(n)]));

  for (const node of all) {
    if (!reachable.has(node))
      problems.push({ state: name(node), message: "cannot be reached from the start" });
  }

  const atomic = all.filter((n) => n.type === "atomic" || n.type === "final");
  for (const node of atomic) {
    if (!reachable.has(node) || isFinal(node) || start.includes(node)) continue;
    const onward = reachableFrom(next(node, true), true);
    const recovers = [...onward].some((n) => start.includes(n) || isFinal(n));
    if (!recovers) {
      problems.push({
        state: name(node),
        message: "is a trap: it is not final and cannot reach the start or a final state",
      });
    }
  }

  for (const node of [root, ...start]) {
    if (node.invoke.length) {
      problems.push({
        state: name(node),
        message: "invokes an actor in the initial state; start it from an event instead",
      });
    }
  }
  return problems;
};

const mermaidId = (node: AnyStateNode) => node.path.join("_");

const renderNode = (node: AnyStateNode, depth: number): ReadonlyArray<string> => {
  const pad = "  ".repeat(depth);
  const lines: Array<string> = [];
  const kids = children(node);
  const init = initialTargets(node);
  if (node.type !== "parallel")
    for (const target of init) lines.push(`${pad}[*] --> ${mermaidId(target)}`);
  for (const child of kids) {
    if (children(child).length) {
      lines.push(`${pad}state ${mermaidId(child)} {`, ...renderNode(child, depth + 1), `${pad}}`);
    }
    if (isFinal(child)) lines.push(`${pad}${mermaidId(child)} --> [*]`);
    for (const edge of edgesOf(child))
      lines.push(`${pad}${mermaidId(edge.from)} --> ${mermaidId(edge.to)} : ${edge.label}`);
  }
  return lines;
};

/** A Mermaid stateDiagram-v2 of the machine, for docs, plans and pull requests. */
export const toMermaid = (machine: AnyStateMachine): string =>
  [
    "stateDiagram-v2",
    ...renderNode(machine.root, 1),
    ...edgesOf(machine.root).map(
      (e) => `  ${mermaidId(e.from) || "root"} --> ${mermaidId(e.to)} : ${e.label}`,
    ),
  ].join("\n");

export interface MachineDoc {
  /** Where the machine lives, from the project root. */
  readonly source: string;
  readonly machine: AnyStateMachine;
}

/** The machines block of a feature's TIMELINE.md: one Mermaid diagram per machine, by source. */
export const machinesBlock = (docs: ReadonlyArray<MachineDoc>): string => {
  if (!docs.length) return "";
  const sorted = [...docs].sort(
    (a, b) => a.source.localeCompare(b.source) || a.machine.id.localeCompare(b.machine.id),
  );
  const sections = sorted.map(
    ({ source, machine }) =>
      `### ${machine.id}\n\nSource: \`${source}\`\n\n\`\`\`mermaid\n${toMermaid(machine)}\n\`\`\``,
  );
  const intro =
    "Written by `bun run machines:print`. `bun run test` fails when a diagram is out of date.";
  return [MACHINES_START, "## Machines", intro, ...sections, MACHINES_END].join("\n\n");
};

/** TIMELINE.md text with its machines block replaced, added after the generated block, or removed. */
export const withMachines = (timeline: string, docs: ReadonlyArray<MachineDoc>): string =>
  withBlock(timeline, MACHINES_START, MACHINES_END, machinesBlock(docs), GENERATED_END);
