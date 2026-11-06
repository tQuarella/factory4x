# Backlog

Owned by the Director. Highest priority first. Each task has an id (used for its branch `task/<id>` and review `reviews/<id>.md`), an owner agent, and acceptance criteria.

## Milestone 0: Bootstrap

| Id | Task | Owner | Status |
| --- | --- | --- | --- |
| m0-deploy | Auto-deploy `main` to a public URL (Cloudflare Pages) | Director | **Done** 2026-11-06: https://factory4x.pages.dev |

Acceptance for m0-deploy: a push to `main` that passes all gates publishes `packages/client/dist` to a public URL; the URL is in `STATUS.md`; the smoke test passes against it at desktop and phone sizes.

## Milestone 1: First playable (starts after the owner confirms the pillars)

Not split yet. The Designer specs H1 in `DESIGN.md` first, then the Director splits it here. Expected slices, for sizing only:

- m1-ecs: entity-component storage and fixed-point math helpers in the sim (Core Engineer)
- m1-extract: asteroid field with extractors
- m1-routes: logistics route to the probe, throughput on screen
- m1-shipyard: probe builds one ship type at a rate set by throughput
- m1-mobs: guarded node with a mob factory producing defenders
- m1-combat: ships attack mobs or their factory
- m1-controls: pause, 1x/2x/4x, tuning panel
- m1-feedback: feedback button with replay attachment (mechanism decided at the time; see QUESTIONS.md)
- m1-bots: real behavior for at least two strategies
- m1-art: sprites or upgraded placeholders for all M1 entities (Art Direction)

## Can wait (allowed while waiting on the owner)

- cw-ci-hardening (needs owner approval: `.github/workflows/` is protected): bump `actions/*` to versions that run on Node 24 (GitHub warns Node 20 is deprecated), and have the live smoke step wait for the deployment URL to answer over HTTPS before testing. A new Pages subdomain's TLS certificate took about a minute on the first deploy and failed the first live smoke run.
- ~~cw-gate-windows~~ **Done** 2026-11-06 (Q9): `protected-files.mjs` now calls git without a shell, so it no longer skips on Windows.
- cw-bench: benchmark scenario with 10k entities for the tick budget once ECS lands
- cw-hud-version (Engineer; added by the Retrospective, 2026-11-06): the HUD shows `BUILD_VERSION` as `main-<run>-<40-char sha>` (set in `ci.yml`), which is long enough to wrap on a 375 px phone. Shorten the displayed version in the client to `<ref>-<run>-<first 7 of sha>` (`packages/client/src/main.ts`, no protected file needed). Keep the full version in the feedback/replay metadata. Acceptance: the smoke test at phone size shows the version on one line, and the full sha is still recoverable from the build.
