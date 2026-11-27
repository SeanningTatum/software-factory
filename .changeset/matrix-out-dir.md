---
"create-tanstack-cf-saas": patch
---

`test:matrix` refuses an out folder that holds files an earlier run did not leave, since a run wipes it. Packing uses the running `bun`, not whichever `bun` is first on `PATH`.
