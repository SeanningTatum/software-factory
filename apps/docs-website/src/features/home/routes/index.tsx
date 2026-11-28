import { createFileRoute, Link } from "@tanstack/react-router";
import { useMachine } from "@xstate/react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { MouseEvent } from "react";
import { fromPromise } from "xstate";
import { navItems } from "#/app/nav.ts";
import { useHydrated } from "#/features/core/ui/components/use-hydrated.ts";
import { Wordmark } from "#/features/core/ui/components/wordmark.tsx";
import { BlockPicker } from "../components/block-picker.tsx";
import { BlockStack } from "../components/block-stack.tsx";
import { blocksMachine } from "../components/blocks.machine.ts";
import { CliCommands } from "../components/cli-commands.tsx";
import { CommandLine, type CopyStatus } from "../components/command-line.tsx";
import { Gates } from "../components/gates.tsx";
import { blockNamed } from "../lib/blocks.ts";

export const Route = createFileRoute("/")({
  component: Home,
});

const REPO = "https://github.com/SeanningTatum/software-factory";
const WRAP = "mx-auto w-full max-w-[76rem] px-4";
const H2 =
  "max-w-[18ch] text-[clamp(2rem,3.8vw,3.25rem)] leading-[1.02] font-medium tracking-[-0.035em] text-balance";
const LEDE = "mt-5 max-w-[62ch] text-muted-foreground";
const SECTION = "pt-[clamp(4.5rem,11vw,9rem)]";
const LINK = "underline decoration-1 underline-offset-4 hover:text-crate-ink";

const machine = blocksMachine.provide({
  actors: {
    writeClipboard: fromPromise(({ input }) => navigator.clipboard.writeText(input.text)),
  },
});

function Home() {
  const [snapshot, send] = useMachine(machine);
  const ready = useHydrated();
  const { picked } = snapshot.context;
  const status = snapshot.value satisfies CopyStatus;
  const copy = () => send({ type: "COPY" });
  const pick = (event: MouseEvent<HTMLButtonElement>) => {
    const name = blockNamed(event.currentTarget.value);
    if (name) send({ type: "TOGGLE", name });
  };
  const links = (
    <div className="mt-5 flex gap-6 text-[0.9375rem]">
      <Link className={LINK} params={{ _splat: "" }} to="/docs/$">
        Read the docs
      </Link>
      <a className={LINK} href={REPO}>
        Star on GitHub
      </a>
    </div>
  );
  return (
    <HomeLayout
      className="[--fd-layout-width:76rem]"
      nav={{ title: <Wordmark /> }}
      githubUrl={REPO}
      links={navItems
        .filter((item) => item.to !== "/")
        .map((item) => ({ text: item.label, url: item.to }))}
    >
      <div className="relative mx-auto w-full max-w-[100rem] overflow-hidden">
        <div
          className={`${WRAP} relative z-10 pt-[clamp(3rem,9vh,6.5rem)] pb-6 lg:min-h-[min(88vh,50rem)] lg:pb-24`}
        >
          <h1 className="text-[clamp(2.75rem,6.2vw,5.25rem)] leading-[1.02] font-medium tracking-[-0.035em] text-balance lg:max-w-[9.5ch]">
            Start every idea from a factory.
          </h1>
          <p className="mt-6 max-w-[34rem] text-[1.1875rem] text-muted-foreground">
            One command builds a SaaS for Cloudflare Workers from the blocks you pick. It wires
            them, tests them and can ship them. Claude Code gets the workflows to keep building.
          </p>
          <BlockPicker picked={picked} disabled={!ready} onPick={pick} />
          <div className="mt-4">
            <CommandLine picked={picked} status={status} disabled={!ready} onCopy={copy} />
          </div>
          {links}
        </div>
        <div className="film-stage aspect-video w-full lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[62%]">
          <video
            className="film size-full object-cover motion-reduce:hidden"
            src="/home/factory.mp4"
            poster="/home/factory.webp"
            aria-label="A pencil drawing of one orange crate carried through a factory: past a gate, along shelves, under robot arms and out to a truck."
            autoPlay
            muted
            loop
            playsInline
          />
          <img
            className="film hidden size-full object-cover motion-reduce:block"
            src="/home/factory.webp"
            alt="A pencil drawing of an orange crate behind a factory gate."
          />
        </div>
      </div>

      <section className={SECTION}>
        <div className={WRAP}>
          <h2 className={H2}>A project holds what you picked, and nothing else.</h2>
          <p className={LEDE}>
            Blocks stack in the order they depend on each other. Take one out and what sits on it
            goes too.
          </p>
          <BlockStack picked={picked} disabled={!ready} onPick={pick} />
        </div>
      </section>

      <section className={SECTION}>
        <div className={WRAP}>
          <h2 className={H2}>Nothing leaves until it passes the gates.</h2>
          <p className={LEDE}>
            <code className="font-mono text-[0.92em]">bun run check</code> runs every gate on your
            laptop. CI runs the same ones on every pull request.
          </p>
          <Gates />
        </div>
      </section>

      <section className={SECTION}>
        <div className={`${WRAP} grid items-start gap-x-20 gap-y-8 lg:grid-cols-[1fr_1.15fr]`}>
          <div>
            <h2 className={H2}>Change your mind later.</h2>
            <p className={LEDE}>
              The same CLI adds a block to a running project, takes one out, and sets up Cloudflare
              and GitHub. Each project also ships a harness for Claude Code: the house rules, a{" "}
              <code className="font-mono text-[0.92em]">/check</code> command and a workflow that
              defines the product with you.
            </p>
          </div>
          <CliCommands />
        </div>
      </section>

      <section className={`${SECTION} pb-[clamp(4rem,9vw,7rem)]`}>
        <div className={WRAP}>
          <h2 className="max-w-[14ch] text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[1.02] font-medium tracking-[-0.035em] text-balance">
            Set it up once. Reuse it for every idea.
          </h2>
          <div className="mt-10">
            <CommandLine picked={picked} status={status} disabled={!ready} onCopy={copy} />
          </div>
          {links}
        </div>
      </section>
    </HomeLayout>
  );
}
