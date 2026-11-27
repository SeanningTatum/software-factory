# Product foundation

## Product

A software factory starter built on Cloudflare, for solo developers who want a sensible factory from the start instead of treating each project as bespoke work; the name is a working name ("software factory", or closer, "cf-saas-software-factory starter"), and the founder is not affiliated with Cloudflare.

## Problem

People vibe code, or cannot build their own software factory because the effort is ginormous. That holds for developers, not only vibe coders. After multiple enterprise projects the founder sees the same problem with business people and developers: once things are established, everyone looks for workflows, not skills, and a workflow needs to live inside a harness or a software factory. Today they invoke skills and plugins by hand and build their own environment. They use Matt Pocock's skills one by one, or similar tools one by one, including Garry Tan's gstack. At a new idea they start blank, use create-t3-app, start from a template, or copy a set of skills. They have nothing to build on top of, so each person becomes the bottleneck instead of a factory. The factory is proven and eval'd to give high quality, predictable designs and code.

## Persona

Solo developer. Alone, at a laptop, with a new idea, building their own SaaS ideas and client work for others. Wants a software factory to start from: set up once, reuse every idea. What stops them: they have nothing to build on top of.

## Core scenario

A solo developer has an app idea and starts a SaaS, every time they have one. They need the latest and greatest tools and workflows. Today they search GitHub links and invoke each skill by hand. Done: they initialize their own factory and get to work.

## Also affected

Teammates, on the developer experience side: they should find it clear. Users of the SaaS products built this way: they should find them polished. Startup teams and agency leads also want a factory to start from; team features such as multi-user permissions or shared agency config are deferred past February 2027.

## Not for

Anyone not on Cloudflare. A developer with no Cloudflare account yet is fine.

## Feel

Simple, composable, succinct. Never complex, bloated or too much.

## Goals

1. By 27 February 2027: 150 GitHub stars.
2. By 27 February 2027: 5 outside repos using it, and 2 to 3 SaaS examples from our internal users.
3. By 27 February 2027: 3 of our own client projects start from the factory.
4. By 27 November 2027: 1000 GitHub stars, and 3 examples of ours plus 5 from outsiders. Hope for traction, with people using it as a framework like shadcn, plugging in features.

Earns by: free and open source; the return is faster client work for us, meaning fewer bugs and more production-ready work instead of AI slop. Maybe a donation page; Buy Me a Coffee would be nice to have.

## Anti-goals

1. Custom skills and custom plugins. We ship workflows, not skills and plugins. We make nothing new; we build a factory for how existing skills and plugins work together. A skill bundled with a workflow is fine if it is useless outside that workflow.
2. Building on any host but Cloudflare. Cloudflare has the best developer experience: add services via wrangler and test locally with the same API. This keeps it a true software factory. Non-Cloudflare services such as Stripe are allowed; only other hosts are banned.
3. A hosted or paid version of the factory (a platform, dashboard or SaaS), and all paid offers. Never. Hosted docs only are fine.

## Assumptions

- People want a whole factory, not single skills. Not proven.
- Others share the problem. The evidence is the founder's own repeated pain, and multiple enterprise projects where business people and developers hit it too.

## Open

- Product: the name is not fixed.
- Problem: vibe coders and business people are named as having the problem, but whether they are users is not said.
- Goals: no stop point is set for February 2027; nothing says what result means change course.
- Goals: "fewer bugs, more production ready" has no measure.
- Goals: no number is set for donations, and a donation page pulls against the ban on all paid offers.
- Goals: outside repos are counted by asking the community or private testers; no exact method or proof is set.
- Goals: 5 outside repos by February 2027 and 5 outsider examples by November 2027 are the same number nine months apart, and 2 to 3 examples of ours against 3 barely differ; one target may be too low. It is not said if an outside repo and an outsider example are the same.
- Anti-goals: no reason is given for never building a hosted or paid version.
- Assumptions: no test is set for whether people want a whole factory.

Agreed 2026-11-27
