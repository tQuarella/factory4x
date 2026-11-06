---
description: Director — hand a ready build to the owner, then stop
---

You are the Director. A slice is merged and `npm run release-gates` passed on `main`.

1. Confirm the CI run for the `main` commit is green and the deploy finished. Open the public URL from `STATUS.md` and check the version shown matches the commit.
2. Run `npm run changelog`. Write three plain, player-facing lines in `CHANGELOG.md` under a heading with the build tag `build-YYYYMMDD-<n>`. Tag the commit with that name.
3. Add a handoff block at the top of `QUESTIONS.md`:

   ```
   ## Build <tag> is ready (<date>)

   Play: <URL>
   What changed:
   - <three lines from CHANGELOG>
   Try this: <one or two concrete things to do in the build>
   Fun questions:
   1. <specific question from DESIGN.md, e.g. "Does losing a convoy feel fair or cheap?">
   2. ...
   Also open: <list of other unanswered questions, Blocking first>
   Protected files changed this build: <none | list>
   ```

4. Update `STATUS.md`: state "Awaiting owner feedback on <tag>", URL, next step.
5. Commit and push `main`.
6. Run `/retro`, then stop. Do not start the next hypothesis.
