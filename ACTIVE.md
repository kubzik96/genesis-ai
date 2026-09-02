# ACTIVE

`ACTIVE.md` is a compatibility entry point, not an independent project-state store.

Start every new Genesis session with:

1. `MEMORY.md` — canonical cross-session operational snapshot and failed-path guardrails;
2. `bridge/QUEUE.md` — canonical task status and ownership;
3. `bridge/HANDOFF.md` — assigned-task context only;
4. linked Decision Records and Approved Specifications.

Do not maintain a second copy of project state here. If `MEMORY.md` is stale, the authorized agent must correct it through the controlled GitHub workflow defined in Memory V1. Existing governance and CEO gates remain unchanged.
