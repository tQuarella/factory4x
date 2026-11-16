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

**Interpretation (Designer, 2026-11-08, iteration 5):** H4 did not support its claim. The bots passed all seven H4 flags, and the build still played as one sequence. The failure has one root cause, which H2 already showed and H3 only hid: **every difference in this game is paid in time.** Ships are unlimited, so quantity can stand in for quality, and research, counters and heavier areas all come down to "a bit longer" or "a bit shorter".
- **Fun question 1 (did getting stronger feel good; which upgrade did you notice): not supported.** "The areas didn't actually feel any stronger. The approach remained the same: max economy then build a fleet and attack once the fleet is twice as strong as the regrowth rate." I read "areas" as the guards: heavier areas didn't feel harder. Read the other way (you didn't feel stronger), the cause is the same. Player strength and area strength grew together, so the felt difficulty was flat:
  - The calibration set it up that way. Flag 2 asked every area to take a similar number of minutes (light 4–9, medium 6–13). In `reports/archive/h4-design-data-v7.md`, ice-line's visits run Frost Shelf 8:42, Spore Veil 9:08 and The Deep 14:31–16:20, while research cut the opening from 2:14 (first light area) to 0:56 (last area). The medium hearts are 51 and 37 guards, against 14 and 10 in the light areas, yet a medium took about as long as a light area.
  - Guard strength never decided anything. DESIGN.md "Calibration result (h4-design-data, data v7)" already noted that the medium hearts grew 42–55% while mean area times moved by 6 s (Spore Veil) and 32 s (Thorn Garden). A bigger heart just means a slightly longer wait for a slightly bigger swarm, which is what the owner did.
  - **A confound:** the reported bug (the extraction rate didn't update with research) hid the most visible grind upgrade on the probe sheet. It weakens criterion 3, but it doesn't explain the unchanged approach.
- **"Even flak vs drone vs lancer didn't feel like a necessary choice" (fun questions 1 and 3): the counters only change speed.** With no limit on ships, enough drones take anything, so a counter is an efficiency, not a requirement. We measured this in H3 and shipped it anyway. Flag 2 ("counters matter") was met on time only: drones-only was 28–32% slower, and the "40% more losses" half failed, 52/57/51 lost against 42/47/38 (DESIGN.md H3 "Calibration result (h3-design-data, data v5)"). The owner's proposed ship limit goes straight at this. Under a limit, the currency stops being ore (that is, minutes) and becomes slots, and a drone slot is worth a quarter of a matched counter's (2 damage against 4 × 200% = 8; see DESIGN.md "Owner direction 2026-11-08b").
- **Fun question 2 (more than one sensible next area): not supported.** "Ice felt like the obvious choice for flak v spore."
  - The two sides are mirror images: ice, Spores and Flak against crystal, Thorns and Lancers. Each side is themed so the read is a single step ("Spores, so Flak"). They were balanced to finish within 1% (flag 3: 1% on all three seeds). So there was nothing to weigh, and the player picked the side that reads cleaner. Balance in time made the pick a coin flip, not a choice; that is the H2 lesson again. The ice side is also 34 s faster on every seed: invisible, but always the same way.
  - The set of areas is fixed. Hauls total 1680 ore against 1660 for all research, and no bot skipped an area (report, "Skipped" column). Flag 6 counted 4 area orders within 15% of the best, but they are orderings of the same six areas reaching the same end state. A different order of the same areas isn't a different path, which is why the overworld "feels too linear".
- **Fun question 3 (fresh puzzle or repeat; a big step): not supported.** "Like a repeat, no big step."
  - Every area is a subset of the same 16-node frame, with the same two guard types and the same build-out, and The Deep is the H3 field the owner played in the previous build.
  - The meaty steps were the two designs. They unlock ships the player didn't need, so the step was a speed-up. Nothing in H4 changes what you can attempt: every open area can be taken on its first visit with enough drones. H3's drones-only bot took every heart, including The Deep's three layouts, at 25:17–27:51 (DESIGN.md H3 calibration table).
- **What the bots measured that didn't become a felt choice.** Flags 3 (two viable sides), 5 (research matters: no-research +42–44%) and 6 (order varies) were all met. Each measured a time gap or counted permutations, and none measured whether a choice changes what you can do. From H5 on, a "choice" flag must measure capability: something can't be done without the choice (for example, drones alone can't take a heart within the limit), the best answer differs between nodes, or which areas are left untaken varies.
- **Success criteria:** 1 (at least 4 areas) is likely met; the owner speaks of later areas but gives no count. 2 (named a reason) is met in letter only: the reason was "obvious", not a choice between two options. 3 (noticed an upgrade) is not met, with the display bug as a confound. 4 (not a repeat) is not met. 5 and 6 weren't mentioned.
- **The overworld direction ("more open-world... steelman that before agreeing"):** steelmanned in DESIGN.md. In short, an open world fixes "linear" only if strength comes in kinds you unlock, not amounts you grind. Without a limit on the fleet it would amplify "max economy then swarm" at map scale. So the ship limit comes first.
- **The bug** (extraction rate display) is routed to an engineer separately. It isn't a design change.

**Action:** DESIGN.md → "Owner direction 2026-11-08b: open world and a fleet cap (steelman)" and "H5 candidates (awaiting the owner's pick)": three slices, with A "Fleet cap" recommended. QUESTIONS.md Q17 asks the owner to pick. Q18 asks about a pillar 1 wording change, which matters only if a fleet cap ships. No spec until the pick.

### 2026-11-08 · idea (no build) · owner

> Idea for later: increase extraction and production depth. Have actual factorio/mindustry/shapez style gameplay on an individual node. This is the lower-level puzzle of maximizing throughput. The max throughput achieved is then applied to all nodes of that type. e.g. you build your ore extraction rig once and that extraction rate gets applied to every ore node. Certain upgrades would likely have you revisit your rig to improve it. Different node types would present different setups on the node. Could be the same for component manufacture too.

**Interpretation (Director):** the owner marked this "for later". It is a candidate direction for after H5 (and the open-world H6), not a change to the current iteration. It touches the VISION fixed decision "Logistics are abstract routes between nodes, not tile-by-tile belts", which a node-level layout puzzle would need to revisit, and pillar 1 ("Throughput is the throttle"), which it would deepen.
**Action:** parked. The Designer steelmans it (including the VISION conflict) when the next direction after H5 is chosen.

### 2026-11-08 · build build-20261108-4 (M2 H5, Fleet cap) · owner

> 1 yes and yes
> 2 yes
> 3 no
>
> Bug: The top bar content started oscillating while gaining and spending resources
>
> When an asteroid buffer is full the toast warming shows and hides rapidly, shifting the buttons under them.

(Answers the three H5 fun questions in order, in chat: 1 "Did the ship limit make you think about which ships to build? Did you ever recycle ships to change your mix?" 2 "Was there an area you couldn't take until a limit raise, a better mix or a Root cut? Did that area feel stronger?" 3 "Did a limit raise feel like a big step?")

A follow-up from the owner on the same build, relayed by the Director (2026-11-08):

> Suggestion: either remove the root mechanic or give some reward for taking the heart without taking the root first.  Right now, there's really no reasonable choice other than taking the root

**Interpretation (Designer, 2026-11-08, iteration 6):** H5 is the first build where the owner's answers support the core claims. The answers are a few words each, so they support little beyond the questions themselves. What's still unknown is listed below.
- **Fun question 1 (did the limit make you think about which ships to build; did you recycle): supported, both halves.** "Yes and yes."
  - The currency moved from ore to slots. A drone slot does 2 damage and a matched counter slot 8, so filling the limit with whatever the yards made stopped working, and Recycle was used to change a mix.
  - This is the centre of the claim (composition is the answer, not size). It's the first time a counter was a requirement and not a speed-up, against H4's "even flak vs drone vs lancer didn't feel like a necessary choice".
  - It's also what no bot exercised: every bot winner cut every Root and often captured with one type (DESIGN.md H5 "Calibration result"). The owner did something the bots didn't, which is the evidence we lacked. Success criterion 2 is met.
- **Fun question 2 (an area closed until a raise, a mix or a Root cut; did it feel stronger): supported.** "Yes."
  - This reverses H4's first complaint ("The areas didn't actually feel any stronger").
  - The cause is the capability windows. The mediums' fed hearts are closed at 12, and The Deep is closed at 12 even with its Root cut (best mixes 13–15). Strength is now a wall you can see, not a longer wait. Criterion 3 is met.
  - We don't know which of the three opened it. The follow-up says the Root, which matches the data: a cut opens a medium at 12 (starved best mix 9).
- **Fun question 3 (did a limit raise feel like a big step): not supported.** "No." Diagnosis in DESIGN.md "H6 candidates" → "Why +6 slots felt small (Q3)". In short:
  - Two of the three raises only replace a Root cut, which is a time saving again. Level 1 opens the fed mediums, which a cut already opened, and only The Deep needs it. Level 2 skips The Deep's cut, and level 3 opens nothing.
  - The key comes before the lock. Level 1 is cheap and the bots buy it at about 12:42, before either medium, so the player never stands at the door it opens.
  - After level 1 the limit stops binding for a Root-cutter (15 slots at most against 18).
  - Nothing on the map changes when you buy one, and +6 is an amount, not a new kind of thing.
- **The Root follow-up: supported by the data, and it's the same flaw as Q3.**
  - A cut costs one small fight, and a fed heart pays exactly what a starved one does. So going for the heart directly is strictly worse, and the bots cut every Root for the same reason.
  - The cut is also the substitute that empties the limit raises. Fixing one fixes most of the other.
  - The owner offers two fixes (remove the Root, or reward the intact take). Both are steelmanned in DESIGN.md "H6 candidates" → "The Root". I recommend the reward, as long as it changes what you can do next, not how fast. The proposal is **Graft**: a heart taken with its Root alive grafts the Root and raises your fleet limit for the rest of the system. It rides along with whichever H6 is picked.
- **Still unknown.**
  - Criterion 4: the owner didn't say "max economy then build a fleet and attack" this time. That's encouraging, but an absence isn't evidence.
  - Criterion 1 (4 areas): likely, since Q2 and Q3 imply a medium and a Command limit purchase, but not stated.
  - Whether choosing a mix was a real trade-off or a mandatory lookup ("Spores, so Flak").
  - Whether the economy felt pointless once the limit was full.
  - Whether the six-area overworld still felt "too linear". The map didn't change and we didn't ask, so the build-3 complaint stands.
  - The cap-off comparison wasn't mentioned.
  - Criterion 6: both bugs are layout shifts, so "nothing in the HUD wraps or jumps" isn't met in the states they describe.
- **Keep:** the fleet limit at 12, Recycle at 50%, capability windows as calibration targets, and capability-only bot flags. Don't retune the cap. Q18 (pillar 1 wording) was "revisit after play". The cap is now supported, so the Director can re-ask it.
- **Bugs:** both are client layout bugs that ship in iteration 6 whatever H6 is picked: BACKLOG `h6-bug-topbar-oscillation` and `h6-bug-buffer-toast-flicker`.

**Action:** DESIGN.md H5 marked tested. DESIGN.md "H6 candidates (awaiting the owner's pick)" has A, Open frontier with locked regions (recommended); B, Keys, not amounts; C, Node rigs (later, not H6); and Graft riding along with A or B. QUESTIONS.md Q19 asks the owner to pick. BACKLOG has the two bug items. No spec until the pick.

### 2026-11-14 · build build-20261108-5 (M2 H6, Open frontier) · owner

(Dictated in chat while playing; the owner stopped at the start of Frost Shelf. The three H6 fun questions are not answered yet.)

> Playing the run now, we'll just dictate as I play through it. Landfall, like just send a drone and you win the heart. And the idea there was to try to introduce you to extraction, which you don't actually have to do. On the next one in Frost Shelf, kind of annoying that the probe starts building drones immediately and you don't actually need them. You want to start with extraction. The build queue isn't fun. The fact that you're limited in how many you can build or queue up for build. I've been thinking about, instead of like building extractors on the asteroids and having the routes, having everything more like ship-based. You build the extractor ships on the probe, from the probe, send them to the asteroids, and then build haulers to run the routes. And then the probe, you're deciding like how to distribute resources between the ships rather than like a build queue of ships. Maybe like a spider graph of the ship types where you're saying which, how much of resources go to each ship type, maybe. Or just a simple build queue. Well, let's try the spider graph idea, because then that would like allow you to easily switch from like how you're balancing your economy to your offensive force. I almost wanted to feel a bit like a simplified game of StarCraft, where it's like econ first, but you need to build a little bit of force to ward off incursions, and then at some point you're deciding whether you go more econ or more offense. To make all that work, the enemy has to be active.  I stopped at the beginning of Frost Shelf

**Interpretation (Designer, 2026-11-14, iteration 7 triage):** two kinds of feedback in one dictation. (a) is three small problems with the first minutes of a run, which hold whatever we build next. (b) is a change of direction, which the owner has already leaned into ("let's try the spider graph idea"). The three H6 fun questions are **not answered**: the owner stopped at the start of Frost Shelf, before any relay, band or area choice. H6 is neither supported nor failed.

*(a) First-run problems (they hold for any next build):*
- **"Landfall, like just send a drone and you win the heart."** The cause is in the data. Landfall's heart has no guards (0 / 0, "the first ship to arrive reclaims it", H4 "Area guards"). The opening stock is 40 ore and a drone costs 18, so the first drone is paid for before any extractor runs. The beat meant to teach extraction can be finished without extracting. **Fix, whatever comes next:** the first area's goal must be out of reach of the opening stock. In the current game that means a heart with a few guards (about 3–4 drones' worth, more than 40 ore buys), or an opening stock below one combat ship. In the H7 direction it means the opening stock buys economy ships only (below).
- **"At Frost Shelf the probe starts building drones immediately and you don't actually need them. You want to start with extraction."** Also by design, and wrong: H4 landing rule 4 turns the drone yard on at every landing to "save a tap", so the first ore goes into drones that sit idle while the player wants extractors. **Fix:** a landing starts with production pointed at the economy, and combat ships only when the player asks.
- **"The build queue isn't fun. The fact that you're limited in how many you can build or queue up for build."** I read this as the economy build queue: one build at a time, at most `build.queueMax` (4) waiting, each extractor and route a separate order. It could also mean the fleet limit (12). The direction in (b) removes the queue either way. The fleet-limit reading is covered by the H7 A/B on whether economy ships count against the limit.

*(b) The direction: a ship-based economy, an allocation graph and an active enemy.*
- **What the owner proposes.** Extractor ships are built at the probe and sent to asteroids, and hauler ships run the routes. Instead of a build queue, the probe's output is split across ship types with a spider (radar) graph, so shifting between economy and offence is one gesture. The target feel is "a simplified game of StarCraft": economy first, a little force to ward off incursions, then a running choice of more economy or more offence. "To make all that work, the enemy has to be active."
- **Why I take it as the baseline and not one option among equals.** It goes straight at the root cause logged since H2: every difference in this game is paid in time, and pillar 4 says time doesn't matter, so no trade-off is felt (H4 triage). An enemy that raids what you build makes time and exposure matter for the first time: an extractor without guards can be lost, and an army built too early is economy you don't have. The fleet limit (H5) made composition matter in slots. Raids make the economy-against-army split matter in the same currency. It also answers "max economy then attack" directly, because maxing the economy unguarded is now the risky line.
- **What it replaces in the current game:**
  - asteroid extractors as buildings (`buildExtractor`), replaced by extractor ships sent to a rock;
  - routes, pods and route upgrades (`buildRoute`, `upgradeRoute`), replaced by haulers assigned to a rock. A route's capacity becomes the number of haulers on it and their round trip, so distance still matters;
  - the build queue (`queue`, `activeBuild`, `build.queueMax`, `cancelBuild`);
  - the per-type yards and their on/off switches and round-robin order, replaced by the allocation;
  - the component step at the probe (lens and plating) probably folds into ship cost, to keep the first slice small;
  - the fleet limit is kept but changes meaning if economy ships count against it (StarCraft's supply). That is an A/B, not a given;
  - Recycle is kept: it becomes the late pivot from economy ships into army under a shared limit.
- **What it keeps:** the counter triangle (Thorns and Spores, Lancers and Flak, Strong/Even/Weak tags, the guard ring, the combat amendment), hearts and their capture, orders at nodes (Guard is now used), pause and speed, autosave, the tuning panel. The overworld, reclaim, research, relays and band locks are **parked, not deleted**: the recommended first slice is one field, and they come back on top of it if the in-area loop holds. If it fails, they are still there.
- **Against VISION.md, pillar by pillar** (full table in DESIGN.md "H7 candidates"):
  - Pillar 1 (throughput is the throttle): **fits better than today.** The probe's delivered ore is the one number the allocation splits. Q18 (the fleet limit) stays open as it was.
  - Pillar 2 (risk scales with reward): fits, and grows. Far rocks are richer and more exposed to raids.
  - **Pillar 3 (Guardians have factories. "Mobs only defend"): conflicts.** Raids are mobs coming for you. The wording needs to change. It also overlaps Q20 (the Root clause).
  - **Pillar 4 (A puzzle, not a race. "No clock and no pressure"): conflicts.** Incursions are pressure by intent. A version without a clock can still hold: raids grow with what you build, never with time, so waiting never makes things worse.
  - Pillar 5: untouched.
  - Fixed decisions: "No fail state" holds if raids kill ships and never the probe. "Logistics are abstract routes between nodes" and "Ships take orders at nodes; no unit micro" both hold: haulers run node-to-node routes, and defence is a Guard order.
  - DESIGN.md's own "Mobs: defend only. They never come for you" (2026-11-06) and "Guards that come for you: ruled out" (2026-11-08b) are superseded by the owner's direction once Q21 is answered.
  - VISION.md is protected, so the pillar 3 and 4 wording goes to the owner in QUESTIONS.md Q21.
- **An active enemy needs the dormant Faction AI agent.** `.claude/agents/faction-ai.md` owns mob behaviour, mob economies and pacing pressure, and it is dormant until a Director entry in DECISIONS.md activates it (PROCESS.md). Activating it is the Director's decision, not the owner's. Raid code should land in its `factions/` module.
- **Phone, not a literal spider graph.** Dragging the points of a radar chart is the precision dragging the phone rule forbids (a five-axis radar in 375 px leaves under 30 px per step). The graph stays as the readout, and the input is a ≥ 44 px − / + stepper per axis. An A/B with snapped drag handles is possible later if the owner asks for it.
- **H6's fun questions: drop them.** All three are about the overworld (relay steps, choosing areas, an open map), which the recommended H7 slice parks. Asking the owner to finish the H6 run would cost a session on mechanics we're about to set aside. If the overworld returns on top of H7, the questions come back with it.

**Action:** DESIGN.md → "H7 candidates (awaiting the owner's pick)": A, "One field, live enemy" (recommended), and B, the same on the H6 overworld. The (a) fixes ride along with either. QUESTIONS.md Q21 asks the owner to confirm the scope and the pillar 3 and 4 wording. DECISIONS.md logs the non-obvious calls (raids scale with economy, not time; steppers, not drag; H6 questions dropped). No spec and no BACKLOG change until the pick.

### 2026-11-14 · build build-20261114-1 (M2 H7, One field, live enemy) · owner

Dictated while playing; full run, hive destroyed.

> So two haulers ended up at A1 when it looks like only one is needed. Some ability to determine how many haulers should be at an asteroid. But do like the extractors auto deploying to marked asteroids. First raid, which was like, oh man, all right, I guess I could do something to defend him. Notification that raid is gathering. It's kind of unclear how this one to five, like the distribution of order or resources to the ships works. Now three haulers at A2, which needs only one. If it feels a little clunky, I have to click the asteroid and send ships there, like a drag, from one asteroid to another. To send the ships from that asteroid to the other would be cool. Maybe hold the button to split them. I just noticed the next raid timer, that's helpful. So an indication of where the raid will go. I guess you wouldn't really know. Is it fun to not know? A2 just got a third hauler. A1 has no haulers. Hey, we fended off our first raid. That felt pretty good. Hate the economy stuff. Pretty good though. I think it'd be better if it had to fight through the military first. So if the military units are there, they keep the economy units alive. Does the raid always hit A1? I think I should probably hit the things closest to the hive should hit the things closest to it first. You can kind of build a front. The haulers should redistribute once they drop at home. Oh, I see. The nearest mined rock to the hive. Okay, I just started mining A5 and then it got hit. That makes sense. Does make it so you only need to defend one asteroid. Nice to have an easier way to designate a rock to be mined. Oh, gee, like hold a button, click, rather than have to click and then say mine this rock. The fleet's full, so the economy units count towards the fleet cap. That's good. It makes the extra haulers sitting around feel much worse, though. Okay, so I have to be a little more picky about which rocks I'm mining. And I don't even think I have enough of a fleet cap to take the hive. I have to, like, pull economy way back. Yeah, and the extra haulers are rough. Okay. Recycling haulers now, which I guess is fine. You could have an icon designation on the asteroid that's going to be raided. I liked the fleet composition in the sidebar, which isn't here right now. Can't see at a glance how many of which ships I have. I'd also be able to be good to just be able to recycle from that ship comp, the fleet comp sidebar, or the fleet comp window, rather than having to go to the asteroid and recycle from there. All right, we got it.  Destroyed the hive.

**Interpretation (Designer, 2026-11-14, iteration 8 triage; all quotes are the owner's):** **H7 is supported.** The owner finished the run, defended a raid and liked it ("That felt pretty good"), endorsed the shared fleet limit ("That's good"), and made the economy-against-offence pivot the hypothesis is about ("I have to, like, pull economy way back… Recycling haulers now… Destroyed the hive"). Nothing in the dictation calls raids a timer or a punishment. The main friction is the hauler layer: about a third of the dictation is about haulers in the wrong place, in the wrong numbers, or taking fleet slots. That is a logistics rule gap, not a failure of the claim. The second friction is that the controls behind the decisions (the 1–5 weights, Mine marking, moving ships, seeing the fleet) are slower or less clear than the decisions themselves.

*Success criteria (DESIGN.md H7):*

| # | Criterion | Score | Evidence |
| --- | --- | --- | --- |
| 1 | First ships are economy ships; no complaint about unwanted drones | **Met** | No drone complaint. "But do like the extractors auto deploying to marked asteroids." |
| 2 | Allocation changed ≥ 3 times, with a reason named for one | **Partly met** | A change with a reason: "I don't even think I have enough of a fleet cap to take the hive. I have to, like, pull economy way back." The count isn't stated; the result panel's `allocChanges` would show it. The weights also confused them: "It's kind of unclear how this one to five, like the distribution of order or resources to the ships works." |
| 3 | A raid met by ships built or moved after its warning; can say whether a raid hurt | **Met** | "First raid… oh man, all right, I guess I could do something to defend them." Then "Hey, we fended off our first raid. That felt pretty good." And on a hit: "I just started mining A5 and then it got hit. That makes sense." |
| 4 | Names a moment of choosing economy or offence | **Met** | "I have to, like, pull economy way back… Recycling haulers now, which I guess is fine." It paid off: "All right, we got it. Destroyed the hive." |
| 5 | Raids not called a timer, rushed or a punishment; run not described as "max economy then attack" | **Met** | Raid targeting "makes sense" and "You can kind of build a front." The run was economy, then defend, then pivot, not a single max-then-attack. One caution: "Does make it so you only need to defend one asteroid." |
| 6 | Never asks how to mine or haul | **Met, with a control gap** | They never asked *how*. They asked for *control* over haulers: "Some ability to determine how many haulers should be at an asteroid." |
| 7 | ≤ 2 taps per action; probe sheet fits; raid UI doesn't shift the HUD | **Not answered** | No layout complaint. Two flows were called slow, though both are within 2 taps: Mine marking ("Nice to have an easier way to designate a rock to be mined") and moving ships ("it feels a little clunky, I have to click the asteroid and send ships there"). |
| opt. | Tries `raid.enabled` 0 or `fleet.countsEconomy` 0 | **Answered without the toggle** | "The fleet's full, so the economy units count towards the fleet cap. That's good." Keep `fleet.countsEconomy` 1. |

*Fun questions (H7):*
1. **Did you change the spider graph, and why?** **Answered in part.** Yes, to pivot to offence once the limit was the bottleneck ("pull economy way back"). The weights themselves weren't clear ("kind of unclear how this one to five… works").
2. **Did raids make you build a little force, or feel like a timer or a nuisance?** **Answered: they made them build force, and it was fun.** "I guess I could do something to defend them" → "we fended off our first raid. That felt pretty good." No timer or nuisance language. They found the next-raid timer helpful ("I just noticed the next raid timer, that's helpful").
3. **A moment of economy against offence, which way, did it pay off?** **Answered: offence, and yes.** "I have to be a little more picky about which rocks I'm mining… pull economy way back… Recycling haulers now… Destroyed the hive."

*One ambiguous line.* "Hate the economy stuff. Pretty good though." comes straight after the first raid and straight before "it'd be better if it had to fight through the military first… they keep the economy units alive." I read it as dictation of "**ate** (or hit) the economy stuff": the raid killed economy ships even though it was beaten. I don't read it as disliking the economy layer, which they praise elsewhere. Q22 lets them correct this in one line.

*Likes (keep):*
- Extractors deploying themselves to Mine-marked rocks.
- The raid-gathering notice and the next-raid timer ("that's helpful").
- Beating a raid ("That felt pretty good").
- Raids hitting the mined rock nearest the hive ("That makes sense", "You can kind of build a front").
- Economy ships counting against the fleet limit ("That's good"). It also made rock choice matter ("I have to be a little more picky about which rocks I'm mining").
- The fleet composition sidebar from earlier builds ("I liked the fleet composition in the sidebar, which isn't here right now").

*Bugs and rule gaps:*
1. **Haulers are staffed per extractor, not by need.** "Two haulers ended up at A1 when it looks like only one is needed", "three haulers at A2, which needs only one". They is right by the arithmetic. F6 spreads haulers by haulers ÷ extractors, so a 2-slot rock tends toward 2 haulers. But a1 and a2 sit 262 su from the probe: at 2 extractors × 10/min, cargo 4 and speed 2, one round trip (262 ticks) moves 2.9 ore, so **one hauler covers each of them** (0.73 of a hauler). By the same sum a3 and a4 need 1 each, a6 and a7 need 2 each, and a5 needs 3. That's 11 for the field, against about 13 under the ratio rule.
2. **Haulers never redistribute.** F6 keeps a hauler on its rock for as long as that rock is worked. "The haulers should redistribute once they drop at home."
3. **"A2 just got a third hauler. A1 has no haulers."** Under F6 a new hauler goes to the worked rock with the lowest ratio, so A1 at 0 should have won. This can only happen if A1 wasn't haulable at that tick (Stopped, or no docked extractor and an empty buffer). The dictation mentions neither. **Unexplained: a bug candidate for an Engineer to reproduce** with a rule test (two worked, marked rocks, one with 0 haulers assigned: the next hauler must go there) and a replay of the field opening.
4. **The allocation keeps building haulers nobody needs, and under the shared limit they cost slots.** "It makes the extra haulers sitting around feel much worse… the extra haulers are rough." A hauler weight above 0 builds haulers forever, and the only cure is to recycle them one rock at a time.
5. **The weights don't explain themselves.** "Kind of unclear how this one to five… works." The rows show weights, not what share of income each type gets.
6. **Economy ships die even when the raid is beaten.** "I think it'd be better if it had to fight through the military first. So if the military units are there, they keep the economy units alive." The rule already strikes warships first *within a round*, but economy ships still die three ways:
   - overflow damage in a round where the defenders fall;
   - defenders that arrive mid-raid only join from the next round;
   - haulers keep flying into the fight (the known issue, Can wait `cw-h7-hauler-raid-wait`).
   They sees the result, not the round order.
7. **One front only.** "Does make it so you only need to defend one asteroid." With a fixed target rule the defence is one rally point. They also liked the front, so this is a watch item, not a fix.
8. **Fleet composition isn't visible.** "Can't see at a glance how many of which ships I have." The H5/H6 sidebar isn't in field mode, so this reads as a regression of something they liked.

*Feature requests:*
- **A hauler count per rock:** "Some ability to determine how many haulers should be at an asteroid."
- **Move ships by dragging from one rock to another, and hold to split:** "a drag, from one asteroid to another… would be cool. Maybe hold the button to split them." Today economy ships can't be sent by hand (F12), and warships are sent from the source sheet.
- **Faster Mine marking:** "hold a button, click, rather than have to click and then say mine this rock." I read it as a Mine mode: hold, or toggle, a Mine button, then tap rocks.
- **A raid target icon on the rock:** "So an indication of where the raid will go… You could have an icon designation on the asteroid that's going to be raided." The banner names the rock, but the map doesn't mark it. Their own "Is it fun to not know?" answers itself two sentences later: they want to know.
- **A fleet composition panel with Recycle:** "be able to recycle from that ship comp… rather than having to go to the asteroid and recycle from there."
- **Raids fight through the military first** (gap 6, as a rule): while warships stand at the rock, economy ships there are safe.

**Action:** DESIGN.md H7 marked tested. DESIGN.md "H8 candidates (iteration 8)":
- ride-alongs for any option: haulers by need, haulers rebalancing at the probe, no surplus haulers, the raid target badge, the fleet panel with Recycle, the unexplained-A1 repro;
- A, "A front worth holding" (recommended): hauler count per rock, military shields the economy, haulers hold back from a raid, Mine mode, clearer weights;
- B, "Move ships by hand": rock-to-rock moves with split;
- C, "The map returns": the H6 overworld on top of the H7 loop.

QUESTIONS.md Q22 asks the owner to pick. The H7 handoff's fun questions are marked answered. No spec and no BACKLOG change until the pick.

### 2026-11-15 · build build-20261116-1 (M2 H8, Hold the front) · owner

> Moving ships felt quick
> Since there is only ever one raid target, it wasn't much of a choice.  It did feel good to repel the first raid. 
> Auto got it right.  At the end though, I wanted to reduce extractor count on specific rocks but couldn't.  If I could dial extractors instead of haulers, wouldn't the haulers balance to the new extraction count?

(Answers to the H8 fun questions 1, 2 and 3, in order.)

**Interpretation (Director's first read; the Designer triages it fully):**
- **Fun question 1 (drag): supported.** "Moving ships felt quick." No word on the long-press half move.
- **Fun question 2 (holding a front): half.** Repelling the first raid felt good, but one raid target means no choice. That's the claim's own disproof wording ("only need to defend one asteroid", DESIGN H8), and it points straight at the parked "wider front" idea (raids at more than one rock, or raids that retarget).
- **Fun question 3 (hauler count): Auto is right, and the per-rock hauler control went unused.** The owner wants the opposite dial: extractors per rock. They're right about the effect: H1's need is the rock's extractors × rate × round trip, so with the count on Auto, fewer extractors means fewer haulers. A per-rock extractor count could replace the hauler stepper as the player's control. Why they wanted it at the end (likely to free fleet slots for the hive push) is for the Designer to read.

**Action:** Designer triage and H9 candidates.

**Interpretation (Designer, 2026-11-15, iteration 9 triage; all quotes are the owner's):** **H8 is partly supported: the controls hold, the decision doesn't.** The two halves the build added to make the front easy to run both worked. Drag is fast ("Moving ships felt quick"), and staffing by need is right ("Auto got it right"). But the claim was that the decision becomes "where do my warships stand, and how many", and it is fun. The "where" half failed in the exact words the spec gave for its disproof: "only need to defend one asteroid", with nothing to decide. The owner: "Since there is only ever one raid target, it wasn't much of a choice." Beating a raid is still fun ("It did feel good to repel the first raid"), as it was in H7. The "how many" half has no evidence from the owner, and the team's own watch items say it is cheap. A guard of 6 beats the full raid of 12, losing 3 (DESIGN.md "Calibration result (h8-design-data, data v14)"), and greedy, which ignores raids, finishes 8 s ahead of adaptive (15:45 against 15:53, same source). So the owner's "not much of a choice" and the bots agree: holding the front costs too little and asks nothing.

*Success criteria (DESIGN.md H8):*

| # | Criterion | Score | Evidence |
| --- | --- | --- | --- |
| 1 | No haulers in the wrong place, no extra haulers | **Met** | "Auto got it right." No hauler complaint, against about a third of the H7 dictation. |
| 2 | Drags ≥ 3 times, one long-press half move; no misfire, no tap turned into a move | **Partly met** | "Moving ships felt quick." No misfire reported. The count isn't stated, and the long-press half move isn't mentioned. |
| 3 | A raid beaten with no economy ship lost, and they notice warships protected the economy | **Partly met** | "It did feel good to repel the first raid." Nothing says whether they saw the shield at work. |
| 4 | Mine mode used, or marking called quick enough | **Not answered** | |
| 5 | Checks the fleet panel or recycles from it | **Not answered** | See "Why they wanted fewer extractors" below: the panel couldn't do what they wanted at the end. |
| 6 | Can say what a weight of 3 does | **Not answered** | No question about the weights this time, against "kind of unclear how this one to five… works" in H7. Weak evidence that the % column helped. |
| 7 | Raids not called a timer or a punishment | **Met** | No such language. |
| 8 | The sheets and the fleet panel fit; nothing in the HUD shifts | **Not answered** | No layout complaint. |

*Fun questions (H8):*
1. **Did you drag ships to meet a raid? Quick? Long-press?** **Answered: quick.** "Moving ships felt quick." The long-press half move is unanswered.
2. **Holding a front worth the slots, or a chore?** **Answered: neither. It wasn't a choice.** "Since there is only ever one raid target, it wasn't much of a choice. It did feel good to repel the first raid." This is the disproof line.
3. **Did you set a hauler count, or did Auto get it right?** **Answered: Auto.** The control they wanted is the other one: "I wanted to reduce extractor count on specific rocks but couldn't."

*Why they wanted fewer extractors, and why they couldn't.*
- **What blocked them.** The rock sheet's Recycle can scrap an extractor at a rock, but H4b reopens the Extractor share the moment one is recycled, so the probe builds a new one for the free slot. The only way to have fewer extractors on a rock was Stop mining, which takes them all. So "couldn't" is accurate: no rule lets the player say "fewer here".
- **Why at the end.** They don't say whether they took the hive, but "at the end" is most likely the hive push. In H7 the same moment was "I have to, like, pull economy way back… Recycling haulers now". My reading is that they wanted fleet slots for the wave and chose to trim per rock rather than drop whole rocks. Two other reasons fit as well: trimming shrinks raids (R4 sizes them by economy ships), and trimming the exposed rocks lowers what a raid can kill. A per-rock extractor count serves all three, so I don't ask which it was.
- **"Wouldn't the haulers balance to the new extraction count?"** Yes. H1's need is the rock's extractors × rate × round trip, and H3 sends a surplus hauler on to another rock, or home to park, on its next delivery. With the probe's H4 and H4b rules counting the lowered number, nothing gets rebuilt. This is the owner's design and it fits the rules as built: the extractor count is the one number the player sets, and the haulers follow.

*Likes (keep):*
- Drag to move ("felt quick").
- Staffing by need ("Auto got it right").
- Repelling a raid ("It did feel good"), now liked in two builds running.

*Rule gaps:*
1. **One raid target, so no choice** (fun question 2). R5 always aims at the mined rock nearest the hive, so the front is a single rally point. A single raid aimed somewhere else wouldn't fix it either: warning time for a5 is about 593 ticks (DESIGN.md H7, "Warning time"), and warships at `ship.speedSu` 4 cross between any two front rocks (a5, a6, a7) in at most 165 ticks (660 su from a6 to a7, from the coordinates in `data/sim.json`). One mobile reserve covers any single target with time to spare. A choice needs **threats at more than one rock at once**, or a stake in what defending earns.
2. **Defending costs little and earns little** (the team's two watch items). A half-size guard wins, and ignoring raids doesn't slow the bots. Beating a raid also buys nothing lasting: at `hive.regrowPct` 200 the hive regrows a Spore every 40 ticks and a Thorn every 120 (`guard.<type>.regrowTicks` × 2), so the 8 Spores and 4 Thorns of a beaten full raid are back in about 480 ticks, or 16 s.
3. **No per-rock extractor count** (above). Recycled extractors are rebuilt.

*Feature requests:*
- **A per-rock extractor count**, in place of the hauler count: "If I could dial extractors instead of haulers, wouldn't the haulers balance to the new extraction count?"

**Action:** DESIGN.md H8 marked tested. DESIGN.md "H9 candidates (iteration 9)":
- a ride-along for any option: the per-rock extractor dial, replacing the hauler stepper on the rock sheet;
- A, "A wider front" (recommended): at a full economy a raid splits and hits the two mined rocks nearest the hive at once;
- B, "Every nest raids": the pockets raid the rocks nearest them, so the front starts at home and moves out as you take nests;
- C, "Strike back": a beaten raid leaves the hive open for a while, so defending pays. It's small, and it can join A.

QUESTIONS.md Q24 asks the owner to pick. DECISIONS.md logs the calls. No spec and no BACKLOG change until the pick.

### 2026-11-16 · build build-20261116-1 (M2 H8) · owner, direction note (for a future iteration)

> For a future iteration: fleet rebuild feels nearly instant on both sides.  There is no possibility for a war of attrition.  This leans into finding the right army comp that beats the hive in one go but it may feel more satisfying if you had to beat down the hive rather than just figure out the army composition that beats it in one go.  I think I'm going back on parts of the vision and we're now building an entirely different game (or sub-part of it) than I originally had in mind.  Originally, I was thinking more Factorio.  Now we're drifting more toward Starcraft.  Maybe there is a Factorio component that influences the Starcraft component?  e.g. combat is essentially distilled Starcraft and overworld logistics to unlock advantages in combat is distilled Factorio.

**Interpretation (Director's first read):**
- **Attrition:** the hive refills in about 16 s, and the probe rebuilds about as fast, so a fight is decided by composition in one push, not by wearing the hive down. VISION pillar 3 ("win a node by out-producing their replacement") wants attrition, so this is drift from the vision, not a new direction. Candidate C from the H9 triage (beaten raiders don't regrow for a window) is one small step toward it.
- **Factorio vs Starcraft:** the owner proposes a layered shape. Combat is distilled Starcraft. Overworld logistics, which unlock advantages in combat, are distilled Factorio. Since H7, the game has been one field with the overworld parked, so the Factorio layer has shrunk to extractors and haulers.
- This may change VISION.md wording (the fantasy, pillar 1). That needs the owner's approval in QUESTIONS.md.

**Action:** not H9 (A, wider front, is in spec). After the H9 handoff, the Designer turns this into a direction question for the owner (H10 candidates, plus any VISION wording to approve), alongside Q18.

