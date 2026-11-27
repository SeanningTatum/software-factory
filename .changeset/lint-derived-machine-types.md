---
"@tanstack-cf-saas/lint": minor
---

Add `derived-machine-types`: in a file that imports xstate or a `*.machine.ts`, an event type written
by hand (`{ type: "START"; ... }`) fails; derive it with `EventFrom` or `ActorRefFrom<...>["send"]`.
