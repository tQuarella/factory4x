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

> Visual direction is good. Everything is readable

**Interpretation:** The `ART_STYLE.md` direction (warm amber player geometry, hot-pink spiky guardians, flat vector on deep space) is confirmed as the baseline, and the placeholder silhouettes read on a phone. Recorded by the Director; the build had no gameplay, so there was nothing for the Designer to triage.
**Action:** none. Keep `ART_STYLE.md` as is; M1 entities follow it.
