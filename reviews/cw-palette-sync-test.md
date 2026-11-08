# Review: cw-palette-sync-test

## Round 1 · 2026-11-07

Reviewed head f0df547 in a separate worktree. Changes: new `packages/client/test/palette-sync.test.ts`; three rows added to the `ART_STYLE.md` Palette table (`Probe glow`, `Mob glow`, `Route line`) whose values match `palette.ts` exactly.

Pillar fit: Process tooling only. No gameplay, rendering, data or sim change, so no effect on how the game plays or feels. It directly targets the miss that caused rejections in m1-art and h2-art round 1.

Acceptance (verified by hand, then reverted):
- Deleted the `Vine pulse` row: `npm run gates -- --base main` fails at `test` with `palette key "vinePulse" (#ffb3cc): no row "Vine pulse" in the ART_STYLE.md Palette table`. The message names the key. Met.
- Changed `Mobs` to `#ff5d74`: fails with `palette key "mob": palette.ts has #ff5d73 but ART_STYLE.md row "Mobs" has #ff5d74`. Value drift is caught.
- Added an unmapped key `newThing` to `palette.ts`: typecheck fails (the `roles` map is `Record<keyof typeof palette, string>`), and the test fails as well. A new colour can't slip through without a mapping.
- Optional contrast check is included: every opaque hex entry except `space` must reach 4.5:1 against `space`, with an explicit allow-list (`starDim`, `witheredDark`, `rootRock`). All pass today.

Quality: Small and clear. Parsing is scoped to the `## Palette` section, CRLF-safe, and keyed by the Role cell, so reordering rows doesn't matter. The mapping from key to role is explicit rather than inferred, which is the right call given that roles are prose. Contrast maths is standard WCAG relative luminance. Test-only code, so no determinism concern.

Determinism / data: Not touched. No tunables and no `dataVersion` impact.

Phone: No UI change.

Protected files: none touched (gate confirms).

Gates: ran `npm ci` then `npm run gates -- --base main` myself. All six passed (typecheck, lint, test, determinism, bots, protected-files).

Non-blocking notes (no change required for this merge):
- The allow-list comment says all three entries are "documented in ART_STYLE.md as low contrast", but `Dim star` isn't marked that way in the table (it's a background star, not an entity, so the 4.5:1 entity rule arguably doesn't apply). Next time Art Direction touches the table, consider annotating the row.
- The check runs one way only: a table row with no `palette.ts` key (for example, a stale row left after a colour is removed) isn't flagged. The backlog didn't ask for that.

Required changes:
- None.

VERDICT: APPROVE
