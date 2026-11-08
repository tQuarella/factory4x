# Playtest log

Owned by the Designer. Each entry: date, build, who (owner or friend name), the feedback verbatim, then the Designer's interpretation and any resulting hypothesis or backlog item. The owner's feedback outranks friends' when they conflict.

## Template

```
### <date> · build <version> · <who>

> verbatim feedback

**Interpretation:** ...
**Action:** DESIGN.md H<n> / BACKLOG <id> / none
```

## Entries

### 2026-11-06 · build build-20261106-2 (M1 first playable, H1) · owner

> Neat! The team did a great job of producing a functioning game. It was mildly satisfying but the solution was obvious and one dimensional. I wanted to replay but seeing the same exact setup was deflating. I didn't use attack with all.

**Interpretation (Director's first read; the Designer triages it fully at the start of the next iteration):**
- **H1 claim 1 (throughput is satisfying on its own): weakly supported.** "Mildly satisfying." The core loop works, but it isn't enough on its own.
- **H1 claim 2 (taking the Bloom is a puzzle): not supported.** "Obvious and one dimensional." There was one dominant line (build everything, mass ships, attack once), with no competing options to weigh. This matches the bots: turtle wins in one wave every time, and its asteroid network plateaus by about 6.5 minutes.
- **Replay desire: yes, but killed by sameness.** "I wanted to replay but seeing the same exact setup was deflating." The result panel did its job of making the owner want another go (answers fun question 3 and Q11 in favour of keeping it). The fixed map is what failed. It points at VISION pillar 5 ("each new system is richer and harder") and seeded map variety.
- **"Attack with all": unused.** The staggered-arrival question is moot for now, so the backlog item stays low priority.

**Action:** next hypothesis (H2) to be chosen with the Designer. The two signals are decision depth (more than one viable way to crack a node) and run-to-run variety (no two systems alike). The owner's priority between them is asked in chat.

**Owner's choice (2026-11-06, in chat):** "Depth first". H2 tests decision depth: more than one viable way to crack a guarded node. A little map variation may ride along, but it isn't the hypothesis.

**Interpretation (Designer, 2026-11-06, iteration 2):** I agree with the Director's read. Four additions:
- **"Obvious" has a mechanical cause.** H1 gave the Bloom one lever, wave size against regrowth, and economy was cheap enough (about 450 ore for the whole network) that building everything first was always right. The bots show this. turtle wins in one wave on every seed. rush loses 72 ships and still takes 25 minutes, so the only other line is strictly worse, not a trade-off. Nothing on the map competes for the player's attention or ships. Adding more of the same lever, such as a bigger Bloom or more thorns, would not help. The fix is a second lever with its own cost.
- **The second lever is already in VISION.** Pillar 3 says "out-produce their replacement, or cut their supply first". H1 built only the first half. H2 builds the second as the Root, a guarded node that feeds the Bloom. Cutting it wilts the Bloom and slows its regrowth, at the price of a second fight. Pillar 2 ("risk scales with reward") comes in through the variants: the Root's strength decides which line is cheaper.
- **Sameness and depth are linked.** On a fixed map, any choice gets solved once and then repeated, which is the "obvious" problem again on the second run. So H2 includes three hand-made systems that differ only in the Root, and New run cycles through them. Asteroids and the Bloom stay fixed, so this doesn't turn into a test of variety.
- **"Mildly satisfying" throughput is not H2's target.** The plateau at about 6.5 minutes is part of why the run felt flat. H2 puts a decision (the Root) into that plateau but doesn't change the economy. If throughput still feels flat after H2, the next candidate is overgrown asteroids that unlock when the Root falls (H2b in DESIGN.md).
- **"Didn't use Attack with all."** It's not needed for H2. Both lines work from a single staging node. Staggered arrival stays low priority.
- **Q11 (result panel):** answered in favour by "I wanted to replay". H2 keeps it and adds the system name and the Root cut time.

**Action:** DESIGN.md H2 ("cutting supply vs overwhelming is a real choice"). The H1 carry-over notes from cw-m1-design-notes and cw-m1-client-notes are decided in H2 → "H1 carry-overs".

> Visual direction is good. Everything is readable

**Interpretation:** The `ART_STYLE.md` direction (warm amber player geometry, hot-pink spiky guardians, flat vector on deep space) is confirmed as the baseline, and the placeholder silhouettes read on a phone. Recorded by the Director; the build had no gameplay, so there was nothing for the Designer to triage.
**Action:** none. Keep `ART_STYLE.md` as is; M1 entities follow it.

### 2026-11-07 · build build-20261108-1 (H2 decision depth) · owner

> Attacking the root first felt like the obvious choice.  Both runs felt the same: max economy then shift to building ships and attack once you have enough. Cutting the root was satisfying

(Answers the three H2 fun questions in order; given in chat after two runs.)

**Interpretation:** pending Designer triage.
**Action:** pending.
