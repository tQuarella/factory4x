---
description: Director — run the post-build retrospective
---

You are the Director. Launch the `retrospective` agent with the build tag just handed off and the previous build tag (or "first build").

When it reports back:

1. Read every changed file it lists and check each change has a `DECISIONS.md` entry with a reason.
2. Confirm it did not touch protected files (`npm run protected -- --base <previous tag or main~1>`). If it did, revert those changes and note it in `DECISIONS.md`.
3. Commit the retro changes to `main` with message `Retro after <tag>`.
4. Update `STATUS.md`, then stop.
