# Questions for the owner

Any agent may add a question. The owner answers inline under **Answer:**. The Director bundles open questions into each build handoff.

To approve a change to a protected file, the owner adds a line `APPROVED-PROTECTED: <path>` under the question.

## Build build-20261106-1 is ready (2026-11-06)

Play: https://factory4x.pages.dev (open it on your phone)

What changed:
- Placeholder page: the probe, an asteroid, a delivery route and a mob, drawn as procedural shapes.
- The simulation runs live in the page at 30 ticks per second.
- Build version shown in the corner so feedback can name the build.

Try this: open it on your phone in portrait, then rotate to landscape. Leave it running for a minute and watch the tick and stock counters climb.

This is the pipeline proof, not gameplay. Milestone 1 is the first build with something to play. So the questions are about look and feel only:

1. Does the visual direction (warm amber geometry for you, hot-pink spiky guardians, flat vector shapes on deep space) feel like the right starting point for this game?
2. On your phone, is everything readable at a glance: can you tell the probe, the asteroid, your ship and the guardian apart without thinking?

**Answer (owner, 2026-11-06, in chat):** "Visual direction is good. Everything is readable"

Also open: Q3 (image service), Q4 (feedback button delivery), Q5 (GitHub branch protection), Q10 (list secret names).

Protected files changed this build: `PROCESS.md` Guardrails section (Q8, approved). Since this build, on `main`: `VISION.md` (Q7, approved) and `.claude/settings.json` (Q8, approved).

## Blocking

### Q9. Ask instead of block for all protected files (2026-11-06, Director)

You asked to act only when it must be you. Today, changing a protected file other than `VISION.md` needs you to edit it by hand. Proposed: move the `Edit` rules for `.claude/agents/critic.md`, `scripts/gates/**`, `.github/workflows/**` and `eslint.config.js` from `deny` to `ask`, as was done for `VISION.md`. After that, every protected change is a prompt you accept or reject, and the Director makes the edit. `.claude/settings.json` stays blocked. First uses: cw-gate-windows and cw-ci-hardening.

You have to apply this one yourself, because agents can't change their own permissions. The Director prepared the file; applying it is one command (given in chat).

**Answer (owner, 2026-11-06, in chat):** applied the prepared settings file, then: "Done, fix the gate"

APPROVED-PROTECTED: scripts/gates/protected-files.mjs

## Answered

### Q6. Connect GitHub and Cloudflare (2026-11-06, Director)

**Answer (owner, 2026-11-06):** Done. Private repo tQuarella/factory4x; secrets set; live at https://factory4x.pages.dev.

### Q8. Let the Director apply approved VISION.md edits (2026-11-06, owner)

**Request (owner, in chat):** "update the protected-file guard to allow you to update vision with my explicit approval each time. i approve these edits"

Change: in `.claude/settings.json`, move `Edit(/VISION.md)` from `deny` to `ask`, so each edit prompts the owner. The Guardrails section of `PROCESS.md` and the rule in `CLAUDE.md` are updated to match. The CI tripwire is unchanged and still requires an `APPROVED-PROTECTED` line per change. Auto mode blocks agents from editing their own permissions, so the owner applies the settings change.

APPROVED-PROTECTED: .claude/settings.json

### Q7. Sign off the revised vision and pillars (2026-11-06, Director)

From the design session on 2026-11-06 (full notes in `DESIGN.md` → Owner direction). Supersedes Q2. `VISION.md` is protected, so the Director needs your approval to apply this. Edit the text freely, then add `APPROVED-PROTECTED: VISION.md` below, or edit `VISION.md` yourself.

Proposed additions to **Fixed decisions**:

- A roguelite campaign: each star system is one 20–40 minute run; the campaign spans many sessions.
- No fail state. You can lose ships and time, never the run.
- Ships take orders at nodes (attack, guard, escort); no unit micro.
- Autosave, so a run survives a closed tab.

Proposed **Design pillars** (replacing the four candidates):

1. **Throughput is the throttle.** Delivery rate to the probe gates everything else.
2. **Risk scales with reward.** The best resources are the best guarded; taking them costs ships, and a bad commitment wastes production.
3. **Guardians have factories.** Mobs only defend, but they repair and replace up to a cap. Win a node by out-producing their replacement, or cut their supply first.
4. **A puzzle, not a race.** No clock and no pressure. The challenge is building an efficient network.
5. **Every system makes the next one stronger.** Research and probe design carry forward, and each new system is richer and harder.

**Answer (owner, 2026-11-06, in chat with the Director):** "Approve as written"

APPROVED-PROTECTED: VISION.md

### Q2. Design pillars (2026-11-06, Director)

**Answer (owner, 2026-11-06):** Revisited in a design session. Superseded by Q7 for sign-off.

### Q1. Which host should serve the public build? (2026-11-06, Director)

**Answer (owner, 2026-11-06):** Cloudflare Pages.

## Can wait

### Q10. Let agents list secret names (2026-11-06, Retrospective)

The deny rule `Bash(gh secret *)` in `.claude/settings.json` blocks every `gh secret` command, including `gh secret list`, which shows only secret names and never values. The Director wanted to run it to confirm the Cloudflare secrets existed before the first deploy. The first deploy was then skipped because the secrets were added after the CI job started. Proposed: replace the rule with `Bash(gh secret set *)`, `Bash(gh secret delete *)` and `Bash(gh secret remove *)`, so agents still can't write or delete secrets but can check that they exist. `.claude/settings.json` is protected and agents can't change their own permissions, so you'd apply this yourself. It could go in with the Q9 change.

**Answer:**

### Q3. Image generation service (2026-11-06, Art Direction)

Procedural placeholders are in place, so nothing is waiting on this. When you're ready: which service, and add its API key as a CI secret and a local environment variable (never in the repo).

**Answer:**

### Q4. Feedback button delivery (2026-11-06, Director)

The site is static, so feedback needs somewhere to go. Default plan: a prefilled GitHub issue link (needs the repo on GitHub and a GitHub account for whoever submits), with a copy-to-clipboard fallback that friends can paste into a chat with you. Is that OK, or would you rather use a form service?

**Answer:**

### Q5. Hard enforcement for protected files (2026-11-06, Director)

Today, protected files are guarded by Claude Code deny rules plus a CI tripwire. Stronger: GitHub branch protection on `main` with CODEOWNERS on the protected paths, so only you can merge changes to them. Want that once the repo is on GitHub?

**Answer:**
