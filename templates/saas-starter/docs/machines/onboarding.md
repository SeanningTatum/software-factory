# onboarding

Source: `src/blocks/workflows/onboarding.machine.ts`

```mermaid
stateDiagram-v2
  [*] --> welcome
  welcome --> wait : STEP_DONE
  wait --> nudge : STEP_DONE
  nudge --> done : STEP_DONE
  done --> [*]
```
