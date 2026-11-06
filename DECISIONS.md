# Decisions

Dated log of decisions and why. Newest at the bottom. Every prompt or process change goes here with its reason.

## 2026-11-06 · Director · Milestone 0 bootstrap

- **Handoff plan revised (rev 2)** after owner review: slimmer roster, cross-engine determinism rules, Critic deadlock rule, protected files, phone-first routes, replays and data versioning. Owner approved. Full text in `docs/HANDOFF_PLAN.md`.
- **Friends access:** public link, no password (owner).
- **Pillars and image generation:** deferred until after Milestone 0 (owner).
- **Stack:** TypeScript, npm workspaces (no extra package manager to install), Vite for the client, Vitest for unit tests, Playwright for the release smoke test, ESLint with typescript-eslint. Source-level workspace exports (`exports: ./src/index.ts`) so there is no build step for the sim.
- **Determinism:** mulberry32 PRNG (integer-only), FNV-1a over canonical sorted-key JSON for state hashes. Gate compares hashes every 300 ticks over 9,000 ticks. The smoke test also runs the reference replay inside the browser and compares with Node, which is the real cross-engine check.
- **Tick budget:** p95 ≤ 2.0 ms per tick on CI hardware. Reasoning: bots must play a 30-minute game (54,000 ticks) in about a minute; real-time play at 30 Hz leaves far more headroom. Revisit with a 10k-entity benchmark once ECS lands (cw-bench). Recorded in `scripts/gates/budgets.json`.
- **Softlock detection:** state hash unchanged for 5 game-minutes. Crude but deterministic; refine when there is real gameplay.
- **Renderer:** Milestone 0 placeholder uses Canvas 2D to avoid a dependency nobody has chosen yet. Engineers pick Pixi, Phaser or similar in Milestone 1 and log it here.
- **Entity storage:** Milestone 0 world is a plain object. ECS is the Core Engineer's first Milestone 1 task (m1-ecs).
- **Roster:** Bot runner and Release replaced by scripts (`npm run bots`, CI deploy + `npm run changelog`). Balance and Faction AI defined but dormant until Milestone 2. Core Engineer (Opus) added for determinism-sensitive work and escalations.
- **Protected-file enforcement:** Claude Code deny rules in `.claude/settings.json` (hard stop for agents' edit tools) plus `scripts/gates/protected-files.mjs` (CI tripwire). The tripwire can be forged, so it is not a security boundary; Q5 offers GitHub branch protection.
- **Worktrees:** engineers run as subagents with Agent isolation `worktree`, on branches `task/<id>`. `npm run worktree` exists for manual use. Merges go only through `npm run merge-task`, which requires `VERDICT: APPROVE` in `reviews/<id>.md` and re-runs all gates on the merged result.
- **Deploy host: Cloudflare Pages** (owner). Fly.io considered and rejected: it runs containers, so a static page would need a server image and a running machine, with no per-branch previews. Deploy is a job in `ci.yml` that runs only after all gates pass: `main` deploys to production (the public link), every other pushed branch to a preview URL. The smoke test then re-runs against the live URL. The job is skipped with a warning until the Cloudflare secrets exist. Project name `factory4x`.
- **Usage budget:** 12 subagent launches per iteration, at most 2 Opus reviews per task. Tunable by the Retrospective (not a gate).
