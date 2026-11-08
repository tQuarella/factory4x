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

**Interpretation (Designer, 2026-11-07, iteration 3):** H2 failed its main claim. The one part that worked, cutting the Root, is worth keeping and building on.
- **"Attacking the root first felt like the obvious choice" (fun question 1): H2 claim not supported.** The bots found the two lines balanced, about 50 s apart on Thin and Deep and 14 s on Knotted, but a human can't feel 50 s in a 10-minute run. Pillar 4 also tells the player that time doesn't matter. Every cost in H2 came down to time: ships lost are just ore, and ore is just minutes. So the trade-off was real on paper and invisible in play. With the numbers that close, the player picks the line that looks safer and feels better, two smaller fights with a visible wilt, and it reads as obvious. **Lesson for H3:** a trade-off measured only in minutes won't register. Choices have to differ in what you get or what you can do next, not in how long they take.
- **"Both runs felt the same: max economy then shift to building ships and attack once you have enough" (fun question 2): the run is still one fixed sequence.** This is the deeper problem, and it is the same cause as H1's "one dimensional". The economy is a closed, unguarded build-out (about 450 ore, done by about 6.5 minutes), and fighting pays nothing until the final prize. So "finish the economy, then build ships" is always right, and the Root only adds one step to the end of that sequence. Changing the Root between runs didn't change the plan, which is evidence that map variety alone won't fix sameness. Success criteria 1, 2 and 4 were not met.
- **"Cutting the root was satisfying" (fun question 3): supported, and the best signal from H2.** The cut reads well (the vine greys, thorns fall, the toast gives numbers) and feels like a payoff, not a chore. Success criterion 3 was met. Keep the Root and the supply cut, and give the player more moments like it.
- **Not a balance problem.** Retuning `map.variants` or `bloom.starved*` would move the 50 s margins around but leave the sequence alone. No retune is proposed.

**Action:** DESIGN.md → "H3 candidates (awaiting the owner's pick)": three options, with Fight to grow recommended. QUESTIONS.md Q13 asks the owner to pick. No spec until then.

### 2026-11-08 · build build-20261108-2 (M2 H3, Counter web) · owner

> The mix of enemy ships at each node added choice. Eg, see the heart is spore-heavy so go win the easiest flak node.
>
> Logistics is still very simple. That may be fine at the scope of a small area.
>
> Idea: connect many areas through an overworld. Once an area is taken its resources can be sent elsewhere. Manage logistics in the overworld and choose the next areas to reclaim. Research persistent upgrades that make it possible to reclaim more heavily defended areas. That is the progression loop. Start with nothing (only able to reclaim an undefended area), that unlocks some additional strength, reclaim richer area, get stronger, repeat, until you have enough resources to build the new probe. That progression should be punctuated with some meatier steps throughout a miner (pun intended) grind. Progression includes new ship types (still need the required resources locally), extraction speed, starting resources, etc

**Interpretation (Designer, 2026-11-08, iteration 4):** H3 is the first build where the core choice worked. The owner then asked for a bigger loop around it rather than more depth inside it.
- **Fun question 1 (more than one sensible next target): answered, supported.** "The mix of enemy ships at each node added choice. Eg, see the heart is spore-heavy so go win the easiest flak node." The owner read the heart's mix, worked out which counter it needed, and picked the cheapest door to that counter. That is the H3 claim in one sentence: the pick was driven by what the prize unlocks, not by distance or time. Success criterion 2 is met in substance (two targets weighed, a reason named).
- **Fun question 2 (ring and tags guided the fleet; did wrong ships sting): half answered.** The mix was clearly read (criterion 3 met for the ring). The owner didn't mention the Strong/Weak tags or a wrong send, so we don't know if a bad send stung. Not a blocker; it will come up again in any slice that keeps counters.
- **Fun question 3 (unlock as payoff; fixed sequence or chosen path): not answered.** There is no comment on whether unlocking flak or lancers felt like a payoff, or on a second game. The absence of "max economy then attack" this time is mildly encouraging, not evidence. Criteria 1, 4, 5 and 6 are unknown. The bots' missed flag 4 (crystal-first a few seconds faster on every layout) did not show up in play, which matches the H2 lesson that seconds are invisible.
- **"Logistics is still very simple. That may be fine at the scope of a small area": the planned H4 is demoted.** H4 "Factories and reach" was going to deepen logistics inside the field (factories on asteroids, route length, relays). The owner is saying one area can stay simple. Depth belongs one level up.
- **The overworld idea is a direction, not a tweak.** Many small areas on an overworld; reclaimed areas ship resources elsewhere; persistent research lets you reclaim heavier areas; start with nothing (one undefended area); the run ends when you can build the new probe; a "miner grind" punctuated by meatier steps (new ship types, which still need their resources locally, extraction speed, starting resources). It fits VISION.md as written: an overworld is one star system, an area is one H3-sized field, and "each new system is richer and harder" (pillar 5) now also happens area by area inside a system. It replaces the planned H4 (in-area factories) and H5 (one big field with pan and zoom) with something that reads better on a phone: every area and the overworld fit one screen.

**Action:** DESIGN.md → "Owner direction 2026-11-08: the overworld (steelman)" and "H4 candidates (awaiting the owner's pick)": three slices, with A "Reclaim ladder" (the progression loop itself: an overworld of small areas plus persistent research, shipments faked as a passive stockpile) recommended. QUESTIONS.md Q16 asks the owner to pick. No VISION.md edit is needed. No spec until the pick.

### 2026-11-08 · build build-20261108-3 (M2 H4, Reclaim ladder) · owner

> 1 The areas didn't actually feel any stronger. The approach remained the same: max economy then build a fleet and attack once the fleet is twice as strong as the regrowth rate. Even flak vs drone vs lancer didn't feel like a necessary choice. Consider a ship limit so you need to build the right composition within that limit rather than just swarming drones. Could increase the limit with research.
>
> 2 Ice felt like the obvious choice for flak v spore
>
> 3 like a repeat, no big step
>
> The overworld feels too linear. Consider going more open-world. Panning is fine, it doesn't need to all fit on the same screen. (steelman that before agreeing). That'd give the player the option to continue reclaiming and build strength before tackling the next challenge.
>
> Bug: I noticed that the extraction rate didn't update to match the current research.

**Interpretation:** pending the Designer's triage (iteration 5).
