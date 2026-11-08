# Design

Owned by the Designer. Current mechanics, open fun hypotheses, and the tunable parameters behind them. Every number named here lives in `data/`.

## Constraints from VISION.md

- Phone-first: every interaction works by touch at 375 px wide. Logistics are routes drawn between nodes.
- Real-time with pause and 1x/2x/4x.

## Owner direction (design session, 2026-11-06)

Answers from the owner, in their words where possible. These shape everything below; the proposed `VISION.md` wording is in `QUESTIONS.md` Q7.

| Topic | Direction |
| --- | --- |
| Shape | **Roguelite campaign.** Each star system is one run of **20–40 minutes**. The campaign of systems spans many sessions. "Shorter sessions but more capability each time." |
| Carry-forward (NG+) | **Research** carries over, **probe design choices** set your next start, and each new system is **harder** (richer resources, tougher guardians). |
| Ship control | **Orders to nodes.** Tap a node, assign a fleet to attack, guard or escort a route. Ships act on their own. No unit micro. |
| Mobs | **Defend only.** They never come for you. |
| Mob factories | Repair and replace defenders **up to a cap**. You take a node by out-producing their replacement rate, or by cutting their supply first. Waiting doesn't make it worse; under-committing wastes ships. |
| Losing | **No fail state.** You can lose ships and time, never the run. |
| Tension | **Optimization puzzle.** No clock, no pressure. The challenge is building an efficient network. |
| Production chains | **3–4 tiers**: ore → refined → components → ships / probe parts. |
| Saves | **Autosave** to the browser every few seconds; a run survives the tab being killed. Campaign progress persists between systems. |
| Mob flavor | Team decides (Designer + Art Direction propose). |

### Consequences the team should design around

- **No fail state + no clock** means the measure of a good run is efficiency, not survival. A per-system result screen (time to probe, ships lost, peak throughput) gives the puzzle a score to beat without adding pressure. Proposal only; confirm with the owner before building.
- **Risk = ship cost.** "Risk scales with reward" now means a richer node costs more ships to take, and a bad commitment wastes production. Losses must read clearly so a failed attack feels like a lesson, not a punishment.
- **Guardian factory math is the core puzzle.** Taking a node means beating `replaceRate × cap` with your delivered fleet, or first raiding the guardian's own supply node to drop its replace rate. Every tunable here goes in `data/`.
- **Short first system.** System 1 should be small enough to finish in ~20 minutes with a 2–3 tier chain; later systems unlock tiers and length via research and harder maps.
- **Saves:** the sim is deterministic, so a save can be a compact state snapshot (or seed + command log). Engineering picks; the requirement is that killing a phone tab loses at most a few seconds.
- **Bots:** with no fail state, bot reports measure time-to-probe and throughput curves instead of win rate. Strategies to keep: rush (attack early), turtle (build economy, attack late), greedy expansion, raid-supply-first.

## Current mechanics

Built in Milestone 1 (build-20261106-2, spec H1 below):

- One star system with a probe, five asteroids and one rich node guarded by a guardian hive (the Bloom).
- Extractors on asteroids, ore routes to the probe with pods you can see moving, and route upgrades.
- A single build queue at the probe, paid from delivered ore.
- A shipyard that turns stock into one ship type, so its rate follows throughput. It can be switched off.
- Ships ordered between nodes (send, rally), with deterministic wave combat at the guarded node.
- Capture of the rich node, a result panel, then free play.
- Pause, 1x/2x/4x, a tuning panel, a feedback button, and autosave.

H2 (build-20261108-1, spec below) added the Root, a second guarded node that feeds the Bloom, and three system variants that differ only in the Root.

## Hypotheses

### H3 candidates (iteration 3, awaiting the owner's pick)

The H2 playtest (PLAYTEST_LOG.md, 2026-11-07) gave three signals. Cutting the Root first felt obvious. Both runs followed the same sequence: max economy, then ships, then attack. Cutting the Root was satisfying. These are the two mechanical causes, and each candidate below attacks one or both:
- **(a) Fixed sequence.** The economy is a closed, unguarded build-out, and fighting pays nothing until the final prize. So "economy first, fight last" is always right, whatever the guardians look like.
- **(b) Time-only trade-offs.** Every cost in H2 was time (ships are ore, ore is minutes). A 50 s gap in a 10-minute run with no clock is invisible, so close choices read as obvious.

All three keep the pillars: no fail state, no clock, defend-only guardians, and orders at nodes with no new kind of input. Only one will be specced, after the owner picks (QUESTIONS.md Q13).

#### H3-A: Fight to grow (recommended)

- **Claim:** when most of the economy sits behind small guards, fighting and building interleave from the first minutes. The order in which you take rocks then becomes the puzzle, and the run stops being "max economy, then attack". Cutting a Root that feeds several guards turns the satisfying moment into one that happens more than once and pays off in ore/min.
- **Attacks:** (a) directly, since you can't max the economy without fighting. Also (b), partly: each choice shows up as ore/min climbing sooner or later, and that compounds where the player can see it.
- **Smallest build:** the H2 map and rules. Two asteroids start free. The other three are **overgrown**, each with its own small guard (thorn counts such as 3 / 6 / 10). Reward does not track guard size: one is poor but close and lightly guarded, another is rich but far and heavily guarded. The Root feeds one overgrown rock as well as the Bloom, so one cut weakens two things. Guards reuse the H2 guardian, wilt and capture rules. No new inputs. The three Root variants become three layouts of the same pieces.
- **Risk:** it collapses into "take the smallest guard first", a new obvious ladder. The bot check: a greedy-cheapest, a greedy-richest and a Root-first strategy, where none may dominate across layouts. The early fights also use few ships, and might feel fiddly rather than meaningful.
- **Pillars:** 1 (throughput gates everything, now including how fast you can grow), 2 (better rocks are better guarded) and 3 (cut supply or out-produce, several times a run).

#### H3-B: Prizes that change your factory

- **Claim:** if each guarded node gives you something different rather than more of the same ore, which fight you pick first changes how the rest of the run plays, and two runs can go differently. One example: the cut Root drops a second material that builds a tougher ship, and the Bloom gives ore.
- **Attacks:** (b) directly, because choices differ in kind, not minutes. It only softens (a): the economy is still built first unless the new material changes that.
- **Smallest build:** one new material from one guarded node, one thing it unlocks (a tougher ship, or route upgrades past level 2), and a second stock line on the probe. The Bloom is unchanged.
- **Risk:** the biggest build of the three (a new resource, recipe and UI). One unlock may simply be best, which gives a new fixed order. It also starts the 3–4 tier chain earlier than planned.
- **Pillars:** 1 and 2, and it seeds 5 (research and probe design carry forward).

#### H3-C: A new system every run

- **Claim:** if every run deals a different map from its seed (how many rocks, where they are, how rich, where the Roots and guards sit), the plan has to be read fresh each time, and replay stops feeling deflating.
- **Attacks:** the "same exact setup" deflation from H1. It doesn't attack (a) or (b).
- **Smallest build:** a seeded generator within fixed bounds, using only existing pieces (asteroids, one Bloom, one Root), plus bot runs over many seeds.
- **Risk:** H2 already changed the Root between runs and the owner's plan didn't change. Variety without new decisions will probably give "the same plan on a different map". It also makes bot balance noisier. It fits better after A or B, once there are decisions worth varying.
- **Pillars:** 5 (each system different) and replay.

#### Considered, not proposed

- **Siege (the Root stays cut only while your ships hold it):** it adds a standing cost, but the cost is still idle ships, which means time. It doesn't break the sequence.
- **Retuning the Root variants for wider gaps:** moves the 50 s margins around without breaking the sequence.
- **Guardians that grow over time:** breaks "waiting doesn't make it worse" (owner direction) and pillar 4.

### H2 (Milestone 1, iteration 2, tested on build-20261108-1): cutting supply vs overwhelming is a real choice

**Result (owner, 2026-11-07):** not supported. Cutting the Root first felt obvious, and both runs followed the same sequence. Cutting the Root itself was satisfying. See PLAYTEST_LOG.md and H3 candidates above.

Owner's pick after the H1 playtest: "Depth first" (PLAYTEST_LOG.md, 2026-11-06). H1's single line was: build everything, mass ships, attack once. H2 tests whether a second, competing line turns the Bloom into a decision.

#### Claim

When a guardian can be beaten in two ways, by **overwhelming** it (one big wave against its full regrowth) or by **starving** it (taking the node that feeds it first, then a smaller wave), and the better way depends on the system, the player weighs the options. Taking the Bloom then feels like a choice, not the obvious line H1 had. This is VISION pillar 3 as written: "win a node by out-producing their replacement, or cut their supply first."

What would disprove it: the owner always takes the same line without looking at the numbers, or calls the Root "a chore on the way to the real fight."

#### The smallest mechanics that test it

Everything from H1 stays: map, economy, shipyard, inputs, combat round, regrowth and HUD. H2 adds four things and **no new input type**:

1. **The Root:** a second guarded node (`root`, map index 7) with its own thorns and regrowth. It uses the H1 combat, capture and regrowth rules. It has no ore and no extractor slots. Once taken, it is only a place where ships can stand.
2. **Supply link:** while the Root lives, the Bloom is **fed** and behaves exactly as in H1. When the Root is captured ("cut"), the Bloom is **starved**:
   - it **wilts** at once to `bloom.starvedCap` thorns, losing its newest thorns first;
   - from then on it regrows at `bloom.starvedRegrowTicks` and repairs `bloom.starvedRepairPerRound`.
3. **Three system variants**, chosen by the seed. They differ only in the Root's position and thorn count, so the best line changes from system to system. The Bloom and the economy are the same in every variant.
4. **Readouts that make the choice weighable:** the Root's sheet and the Bloom's sheet each show what cutting the Root does to the Bloom ("12 thorns, regrows 1 / 2 s → 8 thorns, 1 / 10 s, no repair"). The vine drawn from the Root to the Bloom goes grey when the Root is cut. The result panel names the system and when the Root was cut. **Ships needed is never shown**: estimating it is the puzzle.

Why these and nothing more:
- A permanent cut by capture needs no new input, since `sendShips` to the Root is already an attack. It is readable on a phone, and it reuses the H1 combat code.
- A garrison or siege rule (supply is cut only while your ships stand on the Root) has more depth, but it adds a hold rule and a split-fleet readout. It is the follow-up if H2 says the choice is still obvious.
- The wilt (cap drop) is what makes starving worth it. In the model, slower regrowth and no repair alone only cut the winning wave from about 27 ships to 22, which is too small to notice. With the wilt to 8 thorns, it drops to about 15.
- Starving does **not** make trickling viable. Waves of 6–12 ships every 30–60 s never beat a starved Bloom in the model. H1's lesson, commit enough at once, still holds for both lines.

#### Map variation: included, as three hand-made variants

Included, because the hypothesis needs it. On one fixed map, the better line is found once and then repeated, which is exactly the "obvious" the owner reported. Replay sameness ("deflating") is helped too, but it isn't what H2 measures.

To avoid confounding the test, the variants change **only the Root**. Asteroid positions, slots and yields, the Bloom and every other tunable are the same in each. Procedural jitter of rocks or yields is **excluded**: it would move economy timing, make bot comparisons between strategies noisy, and mix "variety is fun" into a test of "depth is fun".

| Variant | Index | Name | Root x | Root y | Root thorns (`rootCap`) | Model: better line |
| --- | --- | --- | --- | --- | --- | --- |
| `thin` | 0 | Thin Root | 820 | 110 | 4 | Cut the Root: about 50 s faster, same ships lost |
| `knotted` | 1 | Knotted Root | 850 | 420 | 9 | A judgement call: cutting is a few seconds faster but loses about 2 more ships |
| `deep` | 2 | Deep Root | 160 | 480 | 14 | Overwhelm: about 60 s faster, about 6 fewer ships lost |

- **Selecting the variant at world creation:**
  - If `system.variant > 0`, use variant `system.variant − 1`.
  - Otherwise use `((seed mod 3) + 3) mod 3`.

  Store the index in the world. The Root node takes `x`, `y` from the variant. Its effective thorn cap is `max(0, min(40, rootCap + root.capBonus))`.
- The Root's radius is 45, and every Root position is at least 280 su from every other node.
- `map.variants` in `data/sim.json` holds the table above. `map.nodes` gains the `root` entry (kind `root`, `r` 45, `slots` 0), with the `knotted` position as a placeholder.
- **New run** (client) uses `seed + 1`, so consecutive runs cycle through the three Roots and the owner's second run is always a different system. The first-ever run keeps its random seed.

#### Flavor (for Art Direction)

The **Root** is where the Bloom drinks from. It is a hot-pink stalk sunk into a small dark rock, with its own ring of thorns, and a living vine runs from it across space to the Bloom. Pulses travel along the vine toward the Bloom, slowly, so it reads as feeding. Cut the Root and the stalk greys and the vine goes slack and grey. The Bloom drops its newest thorns and dims a little, but stays pink until it is taken. It must stay distinguishable from the Bloom at 24 px: smaller, upright and stalk-like rather than round coral. It follows `ART_STYLE.md`.

Draw contract, which h2-client can call before h2-art merges:
- `drawRoot(ctx, r, t, cut)`;
- `drawVine(ctx, x1, y1, x2, y2, t, cut)`;
- `drawWiltingThorn(ctx, r, frac)`, a thorn falling and fading, with `frac` going 0→1;
- `drawThorn`, reused for the Root's thorns.

#### Rules per tick: changes from H1

The H1 rules stay as written. The changes:

- **Guardians.** The single `guardian` becomes one guardian per guarded node: `rich` (the Bloom) and `root`. Each guardian has `node`, `alive`, `thorns[]` and `regrowProgress`. All guardians loop in node-index order (Bloom 6, then Root 7). Thorn ids still come from `nextId`. The exact layout is the Core Engineer's call, logged in DECISIONS.md.
- **Effective parameters.** Thorn hp and damage are shared: `guardian.thornHp` and `guardian.thornDamage`.

  | Guardian | Cap | Regrow ticks | Repair per round |
  | --- | --- | --- | --- |
  | Bloom, fed (Root alive) | `guardian.cap` | `guardian.regrowTicks` | `guardian.repairPerRound` |
  | Bloom, starved (Root cut) | `bloom.starvedCap` | `bloom.starvedRegrowTicks` | `bloom.starvedRepairPerRound` |
  | Root | variant `rootCap + root.capBonus` (clamped 0–40) | `root.regrowTicks` | `guardian.repairPerRound` |

  The Root starts at its cap, like the Bloom.
- **Rule 7 (combat).** For each living guardian with thorns, fight the H1 round against the ships `at` its node, using its effective repair. Each guarded node has its own battle, so two battles can run at once if the player splits the fleet. `lastBattle` records which node it was.
- **Rule 8 (capture).** The capture condition is the same for each guardian.
  - **Bloom:** as in H1. `capturedTick` still means the Bloom.
  - **Root:** `alive = false`, `root.owned = true`, `stats.rootCutTick = tick`, and the Root battle ends `captured`. Then, if the Bloom is alive, it **wilts**: while its thorn count is above `bloom.starvedCap`, remove its highest-id thorn and add 1 to `stats.thornsWithered`. These are not kills. Set the Bloom's `regrowProgress = 0`.
  - Taking the Root after the Bloom has fallen does nothing more.
- **Rule 9 (regrowth).** Each living guardian regrows using its effective cap and regrow ticks. As in H1, a guardian at or above its cap holds `regrowProgress = 0`.
- **Inputs.** No new inputs.
  - `sendShips` to either guarded node while it is alive is an attack and counts in `wavesSent`. The one-wave-per-tick rule stays.
  - `setTunable` accepts the new keys below. `system.variant` is `newRunOnly`, like `economy.startStock`.
- **Stats.** New fields: `rootCutTick` (null until cut), `thornsWithered`, and `variant` (index).
- **Data version 3.**

#### Observable values: additions

- **Map:**
  - the Root node, a pink stalk drawn with its own thorn ring (reusing `drawThorn`);
  - a **vine** from the Root to the Bloom, pink and alive, or grey once cut;
  - when the Root is cut, the wilted thorns visibly drop off the Bloom (client-side animation, about 1 s).
- **Root sheet:**
  - thorns vs cap, regrowth, thorn and ship hp/damage, ships present and en route (the same block as the rich sheet);
  - Attack and Retreat buttons, as on the rich sheet;
  - a **"Feeds the Bloom"** box: "While the Root lives, the Bloom has 12 thorns, regrows 1 / 2.0 s, repairs 2. Cut it: 8 thorns, 1 / 10.0 s, no repair." All values come from live tunables.
- **Rich sheet:** one line under the thorn count, either "Fed by the Root (cut it: 8 thorns, 1 / 10.0 s)" or "Starved: Root cut".
- **Battle banner:** prefixed with the node name ("BLOOM · strip 1.3/s · regrow 0.5/s · 4 lost", "ROOT · …"). With two battles, show both on one line each.
- **Battle report toasts for the Root:**
  - captured: "Root cut: 15 sent, 3 lost. The Bloom wilts: 12 → 8 thorns, regrows 5× slower." The numbers come from the wilt and the tunables.
  - repelled: "Root held: 10 sent, 10 lost, 2 thorns stripped".
- **Result panel:** adds the system name ("Thin Root"), and "Root cut at 8:12" or "Root left standing". Ships lost includes the Root fight.
- **Probe sheet:** the system name in small text.
- **Tuning panel:** the new keys. `system.variant` shows "0 · by seed / 1 Thin / 2 Knotted / 3 Deep" and applies on New run.

#### Touch interactions

Nothing new to learn. The Root is a node: tap it to see its sheet, and attack it from there with the existing target-first buttons. Rally can be set on the Root once it is cut.

The Root's hit area is at least 44 px and covers its thorn ring. The same change applies to the Bloom, which closes the "thorns drawn outside the tap area" note.

Labels for nodes near the top edge (Thin Root at y 110, the Bloom) must not clip. This folds in cw-bloom-label-clip.

#### Tunables (new; data/, all integers)

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `root.capBonus` | 0 | −14 to 20 | −14: every Root is unguarded and cutting is free (starve dominates) / 20: every Root is a fortress (overwhelm dominates) |
| `root.regrowTicks` | 60 | 15–1800 | 15: the Root needs a big wave of its own / 1800: chip it down at leisure |
| `bloom.starvedCap` | 8 | 1–40 | 1: cutting the Root nearly wins the Bloom / 12 or more: cutting removes no thorns, only slows regrowth |
| `bloom.starvedRegrowTicks` | 300 | 15–1800 | 60: no regrowth change / 1800: regrowth effectively stops |
| `bloom.starvedRepairPerRound` | 0 | 0–20 | 0: damage sticks / 2: same as fed |
| `system.variant` | 0 | 0–3 | 0: chosen by seed / 1–3: force Thin, Knotted or Deep (new run only) |

`map.variants` (positions, `rootCap`) is data that needs a restart, like `map.nodes`. `root.capBonus` is the live knob for the Root's strength. It is a bonus rather than a live `root.cap` because New run keeps live tuning, and a tuned `root.cap` would erase the difference between variants. In the "Feels like" column, the existing `guardian.*` keys now mean "the Bloom while fed", plus the thorn stats shared by both guardians.

**Calibration** (throwaway model of these rules in the scratchpad, using H1 economy timing: the asteroid network plateaus at about 6.6 min, then about 10.8 ships/min):

| Line | Ships sent | Ships lost | Model capture |
| --- | --- | --- | --- |
| Fed Bloom, overwhelm | 32 (min 27) | 11 | 9.7 min |
| Starved Bloom (8 thorns), after the Root | 18 (min 15) | 8 | — |
| Thin (Root 4), starve | Root 15 (min 13) | 3 | 8.9 min |
| Knotted (Root 9), starve | Root 28 (min 21) | 7 | 9.65 min |
| Deep (Root 14), starve | Root 40 (min 30) | 12 | 10.75 min |

Survivors of the Root fight join the Bloom wave. Focus fire leaves at most one wounded survivor.

#### Bot strategies (H2)

- **rush:** unchanged from H1. It ignores the Root.
- **turtle** (the overwhelm line): unchanged from H1. It ignores the Root. It doubles as a regression check, because a fed Bloom must behave exactly as in H1.
- **raid-supply** (the starve line; replaces the stub):
  1. Same economy plan as turtle, with the shipyard off until the plan is done.
  2. Then: shipyard on, rally `probe`.
  3. While the Root is alive, no ships are at or heading to `root`, and ships at `probe` ≥ `rootWave`: `sendShips(probe, root, 0)`.
     - `rootWave = ceil(rootThorns × 5 / 2) + 5`, where `rootThorns` is the Root's current thorn count. That gives 15, 28 and 40 for the three variants.
     - If repelled, it recomputes and waits again.
  4. On the tick after the Root is cut: `setRally a5`, then `sendShips(root, a5, 0)`.
  5. When ships at `a5` ≥ `bloomWave` and none are at or heading to `rich`: `sendShips(a5, rich, 0)`.
     - `bloomWave = ceil(bloomThorns × 9 / 4)`, where `bloomThorns` is the Bloom's current thorn count. That gives 18 at 8 thorns.
     - If repelled, it waits again.
  6. After capture: build out `rich`, like turtle.
- **Seeds.** The suite's seeds 1, 2 and 3 map to variants knotted, deep and thin, so the default `--seeds 3` covers all three. The report labels every row with its variant.
- **Report additions** (per strategy and seed):
  - the variant id;
  - the Root cut time (or null);
  - ships lost at the Root;
  - thorns withered;
  - waves sent per target.

  Plus a per-variant comparison table: turtle vs raid-supply capture time and ships lost at capture.

**Bot tuning targets** (report flags, not merge gates). Together they are the evidence that neither line dominates:
1. turtle and raid-supply capture in every variant, within 8–13 game minutes.
2. `thin`: raid-supply captures at least 30 s before turtle.
3. `deep`: turtle captures at least 30 s before raid-supply.
4. `knotted`: the two capture times are within 45 s of each other (a judgement call).
5. **No dominance:** neither strategy is at least as good as the other on both capture time and ships lost at capture in all three variants. In practice: each captures first in at least one variant, and turtle loses fewer ships in at least one.
6. Regression: turtle's capture matches the H1 report (9.8 min ± 10 s, 1 wave), because a fed Bloom is unchanged.
7. rush keeps its H1 targets, and nothing softlocks.

If the real numbers miss these, report them; the Designer retunes `map.variants` and the `bloom.starved*` defaults. The engineers do not retune.

#### Success criteria (the owner, one ~20 minute phone session, two runs)

Use 2x/4x freely once the economy is built. A run is about 10 game minutes.
1. In run 1, before the big attack, the owner has opened both the Root's and the Bloom's sheets and can say in one sentence why they did or didn't cut the Root.
2. Run 2 is a different Root (New run cycles them). The owner either changes plan, or can name what about this system would make the other line better.
3. Cutting the Root reads without explanation: the vine goes grey, thorns visibly fall off the Bloom, and the toast says by how much.
4. The owner does not call the solution "obvious" or "one-dimensional", and the answer to fun question 1 names a trade-off.
5. Each run still captures in about 8–15 minutes. Every action is at most 2 taps from the map, not counting the confirm tap on Cancel and New run. This rewords the H1 criterion, which conflicted with Cancel's confirm.

#### Fun questions for the handoff

1. Before your big attack, did you weigh cutting the Root against hitting the Bloom head-on? What tipped it, and did it feel like a real choice or an obvious one?
2. Your second run had a different Root. Did you change plan? Could you tell from the numbers on the sheets which way was better, or was it a guess? Did the new system make the replay feel fresh?
3. When the Root fell and the Bloom wilted, did that feel like a payoff in itself, or like a chore on the way to the real fight?

#### H1 carry-overs folded into H2 (client, small)

Decisions on `cw-m1-design-notes` and `cw-m1-client-notes`:
- **Tap areas:** the hit areas of guarded nodes cover their thorn rings (see Touch).
- **Tuning panel:** tick values also show seconds ("60 · 2.0 s").
- **First-run hint:** it moves into the notices strip, so it no longer covers the probe.
- **Banner wording:** "BATTLE · strip … · regrow … · N lost" is confirmed, with the node-name prefix above.
- **Kept as is:**
  - the shipyard starts on (the first ship by about 2 minutes matters more than a 25 s delay to the first extractor);
  - the map jump while a toast shows (cw-map-jump; the owner didn't mention it);
  - staggered "All" (unused by the owner; stays low priority).

#### Out of scope for H2

Each is a candidate for later:
- garrison or siege supply cuts;
- ore on the Root;
- overgrown asteroids that unlock when the Root is cut (this would make the economy order a decision too; candidate H2b if the plateau is still dull);
- more than one Root;
- a second ship type;
- procedural maps;
- research, tiers and NG+.

### H1 (Milestone 1, tested on build-20261106-2): growing throughput is satisfying, and taking a guarded node is a puzzle

**Result (owner, 2026-11-06):** claim 1 was weakly supported ("mildly satisfying"). Claim 2 was not supported ("obvious and one dimensional"). The result panel made the owner want to replay. See PLAYTEST_LOG.md. The H1 mechanics below stay as the base for H2.

#### Claims

1. **Throughput is satisfying on its own.** Watching delivered ore per minute climb, and seeing ship production speed up as a direct result, is fun before research, tiers or NG+ exist.
2. **The guardian is a puzzle, not a wait.** Taking the guarded node by building enough production to beat its regrowth in one committed wave feels like solving something. Failed early attacks read as lessons, and the payoff is a visible jump in throughput.

#### Scope decisions

- **One production tier.** Asteroids give ore, ore goes to the probe, and the probe builds ships and structures. Both claims are about the rate of delivery and the fight against regrowth. Refining and components add chain decisions, which are a different hypothesis (H2). If one tier isn't satisfying, more tiers won't fix it. The 2–3 tier first system and the 3–4 tier chain come after M1.
- **"Done with the run" = capture plus a result panel, then free play.** When the rich node falls, a dismissible panel shows the time to capture, peak throughput, ships built, ships lost and waves sent. The game keeps running so the owner can watch the throughput jump, and "New run" is in the menu. The HUD shows no clock during play. The panel gives the puzzle a score to beat without adding pressure. "Consequences" above asks to confirm a result screen with the owner first, so it ships behind a tuning-panel toggle (default on) and is asked as QUESTIONS.md Q11 and handoff question 3.
- **Autosave is in M1.** It is a fixed decision in VISION.md, and phone browsers kill background tabs. A 15-minute test run lost to an app switch would wreck the playtest. The sim state is already plain serializable data, so it is cheap: one slot, at most 5 s lost.
- **Out of scope for M1** (later hypotheses): attacking the hive directly, the hive's own supply line and raid-supply play (H2 candidate), escort orders, multiple resources, research, the new-probe win, NG+, more than one system, camera pan/zoom.

#### Mob flavor (proposal for Art Direction)

**The Bloom**: a hot-pink, coral-like hive grown into the richest rock in the system, glowing because it is alive. It buds **thorns**, spiky seed-pods that orbit the rock and lash any ship that comes close. It keeps regrowing them until the rock is ringed again. Taking the rock means stripping every thorn faster than it buds. When the last thorn falls, the Bloom withers to grey and the rock's teal ore shows through.

#### Map: the M1 system

The world is 1000 × 1400 sim units (su), with the origin at the top left and y pointing down. The whole map fits a 375 px wide portrait screen (about 0.375 px/su) with no pan or zoom. Node centers are at least 140 su apart, so the 44 px touch targets never overlap. The map is fixed (no RNG) and lives in data as `map.nodes`. Radii are for drawing; touch hit areas are at least 44 px no matter the radius.

| Id | Index | Kind | x | y | Radius | Extractor slots | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `probe` | 0 | probe | 500 | 1180 | 70 | 0 | Player core. Owned from the start. Every route ends here. |
| `a1` | 1 | asteroid | 330 | 1000 | 45 | 2 | Nearest, small. Route length 248, cost 9. |
| `a2` | 2 | asteroid | 700 | 1010 | 50 | 3 | Near. Route length 262, cost 10. |
| `a3` | 3 | asteroid | 220 | 760 | 50 | 3 | Mid. Route length 504, cost 15. |
| `a4` | 4 | asteroid | 790 | 720 | 55 | 3 | Mid. Route length 543, cost 15. |
| `a5` | 5 | asteroid | 480 | 560 | 60 | 4 | Forward rock and natural staging point; 330 su from `rich`. Route length 620, cost 17. |
| `rich` | 6 | rich | 500 | 230 | 90 | 4 | Guarded by the Bloom (the hive is part of this node, not a separate node). Ore yield 2.5× an asteroid once captured. Route length 950, cost 24. |

Route length is the integer square root (floor) of the squared center distance, computed once when the route is created. Ship travel uses the same lengths (probe→rich = 950 su, about 8 s at 1x).

#### Entities and state

Everything is an integer. Ore is counted in whole units. Per-minute rates turn into whole ore through accumulators (see Rules), so no fractional state exists anywhere and no ×1000 scale is needed. The map has no RNG; `rng` stays in the state for later milestones.

- **World:** `tick`, `rng`, `dataVersion`, `nextId`, `stock` (ore at the probe), `probeAccum`, `queue` (unpaid build orders, FIFO), `activeBuild` (`{kind, node, ticksLeft}` or null), `shipyard` (`{on, ticksLeft}`; `ticksLeft = 0` means idle), `rally` (node index, default `probe`), `nodes[]`, `routes[]`, `ships[]`, `guardian`, `battle` (current or null), `lastBattle`, `stats`, `capturedTick` (null until capture).
- **Node:** `index`, `kind` (`probe | asteroid | rich`), `x`, `y`, `r`, `slots`, `owned` (bool), `extractors` (built count), `buffer` (ore waiting for pickup, ≤ `node.bufferCap`), `accum`.
- **Build order:** `kind` (`extractor | route | upgrade`), `node` (the source node for routes and upgrades), `cost` (locked when queued, shown on screen).
- **Route:** `id`, `from` (node), `to` (always `probe` in M1), `length`, `level` (1..`route.maxLevel`), `cooldown` (ticks to the next pod launch), `pods[]` (`{amount, ticksLeft}`, oldest first). One route per source node.
- **Ship:** `id`, `hp`, and either `at` (node index) or `transit` (`{from, to, ticksLeft, totalTicks}`). The client interpolates the position from `transit`.
- **Guardian (the Bloom):** `alive` (bool), `thorns[]` (`{id, hp}`, oldest first), `regrowProgress` (ticks).
- **Battle:** `startTick`, `shipsEngaged` (distinct ships that fought in at least one round), `shipsLost`, `thornsKilled`. When it ends it is copied to `lastBattle` with `endTick` and `outcome` (`captured | repelled | withdrew`).
- **Stats:** `deliveredBuckets[60]` (ore delivered by routes per game second, ring buffer), `peakPerMin`, `shipsBuilt`, `shipsLost`, `thornsKilled`, `wavesSent`, `firstShipTick`, `oreSpentShips`, `oreSpentEconomy`.

#### Rules per tick (in this order)

`T` = `tickRate × 60` = 1800 ticks per game minute.

1. **Inputs.** Apply this tick's inputs in order. An invalid input is ignored with no state change. The client greys out actions that would be invalid, so this only guards against stale taps and bots.
2. **Construction.** If `activeBuild` exists, decrement `ticksLeft`. At 0, apply it:
   - extractor: `extractors += 1`, `owned = true`;
   - route: create it at level 1, with `cooldown = 0`;
   - upgrade: `level += 1`.

   Then, if there is no active build and `stock ≥ queue[0].cost`, pay the cost, pop the head and start it (`extractor.buildTicks` or `route.buildTicks`; upgrades use `route.buildTicks`). One build runs at a time.
3. **Extraction.** For each node with extractors, add `extractors × yield` to `accum`, where yield is `extractor.orePerMin` for asteroids and `rich.orePerMin` for the rich node. While `accum ≥ T`, subtract `T` and add 1 ore to `buffer` if `buffer < node.bufferCap`; otherwise the ore is lost. A full buffer is a visible "backed up" state, so the bottleneck shows on screen. Probe mining: `probeAccum += economy.probeOrePerMin`, and while `probeAccum ≥ T`, subtract `T` and add 1 to `stock`. This keeps a dead network from ever softlocking.
4. **Routes.** For each route: if `cooldown > 0`, decrement it. If `cooldown = 0` and the source buffer is above 0, launch a pod with `amount = min(buffer, level × route.podOrePerLevel)` and `ticksLeft = ceil(length / route.podSpeedSu)`, and set `cooldown = route.podIntervalTicks`. Decrement every pod's `ticksLeft`. Pods at 0 deliver their ore to `stock` and to `deliveredBuckets[(tick / tickRate) mod 60]`. Route capacity per minute = `level × podOrePerLevel × T / podIntervalTicks` (20 per level at defaults). Distance adds latency, not capacity limits.
5. **Shipyard.** If `ticksLeft > 0`, decrement it. At 0, a ship spawns at `probe` with `ship.hp`; if `rally ≠ probe`, it starts transit to `rally` at once. Then, if the yard is `on`, idle, and `stock − Σ queue[].cost ≥ ship.cost`, pay and start a ship with `ticksLeft = ship.buildTicks`. Queued builds reserve their ore, so they always take priority over ships. Ships per minute therefore follow `min(income / ship.cost, T / ship.buildTicks)`; at defaults the second term (20/min) does not bind before capture.
6. **Movement.** For each ship in transit, decrement `ticksLeft`. At 0 it arrives (`at = to`). `totalTicks = ceil(length(from, to) / ship.speedSu)`.
7. **Combat** (only while `guardian.alive`). On ticks where `tick mod combat.roundTicks = 0`, if any ship is `at` `rich` and thorns exist, fight one round, resolving both sides at the same time from counts at the start of the round:
   - Player damage = ships present × `ship.damage`. It is applied to thorns in id order (oldest first) and overflows to the next thorn.
   - Bloom damage = thorns × `guardian.thornDamage`. It is applied to ships present in id order and overflows the same way.
   - Units at hp ≤ 0 are removed. Update the battle and stats counters.

   Then, on every round tick whether or not there is a fight, each surviving thorn heals `guardian.repairPerRound` up to `guardian.thornHp`. A battle starts on the first round with ships present. It ends when no ships are present: `repelled` if the last ones died, `withdrew` if they left.
8. **Capture.** If `guardian.alive`, there are no thorns, and at least one ship is `at` `rich`:
   - `alive = false`, `rich.owned = true`;
   - `rich.extractors = min(rich.freeExtractors, slots)`;
   - `capturedTick = tick`, and the battle ends `captured`.

   The node is the player's for the rest of the run; mobs never retake it.
9. **Regrowth.** If `guardian.alive` and there are fewer than `guardian.cap` thorns, `regrowProgress += 1`. At `guardian.regrowTicks`, add a full-hp thorn with a new id and reset to 0. At the cap, `regrowProgress = 0`. The Bloom starts at the cap.
10. **Stats.** On the first tick of each game second, zero the bucket being entered. `throughputPerMin = Σ deliveredBuckets`, and update `peakPerMin`.
11. `tick += 1`.

Calibration at defaults, from a throwaway model of these rules (to be confirmed by the bots):
- A full Bloom (12 thorns) beats a simultaneous wave of 26 ships.
- About 28 ships win, losing about 15. 35 ships win losing about 10, so bigger waves are cheaper.
- A trickle (rally at `rich`) never wins.
- With regrowth every 30 ticks instead of 60, about 35 ships are needed; regrowth is the main lever on wave size.
- Asteroids max out at 150 ore/min, and capture adds 100/min (≈ +65 %).

#### Player inputs (the sim's `Input` union)

Node and route parameters are node indices. The placeholder `noop` and `boost` inputs are removed.

| Input | Parameters | Valid when | Effect |
| --- | --- | --- | --- |
| `buildExtractor` | `node` | node is an asteroid, or `rich` after capture; built + queued + active extractors < slots; queue length < `build.queueMax` | Queue an extractor at `extractor.cost`. |
| `buildRoute` | `from`, `to` | `to = probe`; `from` has no route and none queued; `from` has an extractor built, active or queued; queue not full | Queue a route at `route.costBase + floor(length × route.costPer100Su / 100)`. |
| `upgradeRoute` | `from` | route from `from` exists; level + queued upgrades < `route.maxLevel`; queue not full | Queue an upgrade at `route.upgradeCostPerLevel × (target level − 1)` (20, 40, 60, 80 at defaults). |
| `cancelBuild` | `index` | `0 ≤ index < queue.length` (unpaid orders only) | Remove that order. Nothing was paid, so nothing is refunded. |
| `setShipyard` | `on` (bool) | always | Turn ship production on or off. A ship already in progress finishes. |
| `sendShips` | `from`, `to`, `count` (0 = all) | `from ≠ to`; at least 1 ship `at` `from` | The lowest-id `count` ships at `from` start transit to `to`. Sending to `rich` while it is guarded is an attack and counts in `wavesSent`; anywhere else it is a move (they guard there). Leaving `rich` mid-battle is a retreat. |
| `setRally` | `node` | any node | Newly built ships fly here automatically. |
| `setTunable` | `key`, `value` (int) | `key` is a tunable listed below, not `map.*`, `tickRate` or `stats.*`; value in range | Change a tunable from the next tick on. It is recorded in the input log, so replays and feedback reproduce tuned sessions. If the Core Engineer prefers another mechanism (for example data snapshots in the replay), log it in DECISIONS.md; the requirement is that a replay reproduces a session with live tuning. |

Time controls (pause, 1x/2x/4x) are client-only and never enter the sim. At 2x and 4x the client steps the sim 2 or 4 times per frame tick.

#### Observable values (HUD and node sheets)

- **Top bar, always visible:**
  - delivered ore/min (`throughputPerMin`, the biggest number on screen), with an up or down arrow against 10 s ago;
  - stock;
  - total ships, and ships/min at the current income.
- **Probe sheet:**
  - shipyard on/off and its progress bar;
  - build queue (up to 4 icons with costs) and active build progress;
  - probe mining (+12/min);
  - rally point.
- **Asteroid sheet:**
  - extractors built/slots, shown as pips;
  - extraction ore/min;
  - route level and capacity ore/min;
  - buffer fill bar, with a "backed up" warning when full ("route at capacity: upgrade") and a "no route" warning when extracting with no route.
- **Rich node sheet, before capture:**
  - thorns alive vs cap ("9 / 12");
  - regrowth as "1 thorn / 2 s" plus a progress ring;
  - thorn hp and damage, and ship hp and damage, as plain numbers;
  - ships present and ships en route.
- **During a battle**, on the rich sheet and as a banner:
  - your kill rate vs regrowth ("you strip 2.4 thorns/s · Bloom regrows 0.5/s");
  - ships lost so far.
- **On the map:**
  - pods moving along routes, one dot per pod, sized by amount;
  - ships as small arrowheads in transit, and a count badge on nodes with ships;
  - the thorn ring around `rich`, one spike per thorn;
  - a flash on hits each combat round.
- **Battle report toast** when a battle ends: "Wave repelled: 18 sent, 18 lost, 5 thorns stripped" or "Captured: 30 sent, 12 lost". It stays until tapped.
- **Result panel on capture** (behind the toggle):
  - game time to capture;
  - peak ore/min;
  - ships built and lost;
  - waves sent.

  Buttons: "Keep playing" and "New run".
- **Throughput sparkline** of the last 10 minutes on the probe sheet (client-side history; it doesn't need to be sim state).

#### Touch interactions (375 px portrait, no hover, 44 px targets)

- **Layout:**
  - Top bar, row 1 (48 px): ore/min, stock, ships.
  - Top bar, row 2 (48 px): pause, 1x, 2x, 4x, tuning (gear), feedback. These are six 52 px buttons.
  - Map in the middle.
  - A bottom sheet (up to about 45 % of the height) opens when a node is selected.

  In landscape the bars move to the left edge; the client decides the details.
- **Select:** tap a node (hit area at least 44 px). Tap empty space or the sheet's close button to deselect. Routes are never tap targets; all route actions live on the source node's sheet.
- **Build extractor:** asteroid sheet → "Extractor · 20". One tap; it queues.
- **Build route:** asteroid sheet → "Route to probe · 9". One tap. The button is enabled as soon as an extractor is built or queued.
- **Upgrade route:** asteroid sheet → "Upgrade route → L2 · 20".
- **Cancel build:** probe sheet → tap a queued icon, then "Cancel" (a second tap, to prevent mistaps).
- **Shipyard:** probe sheet → on/off toggle.
- **Send ships (target-first, no drag):** select the destination, and the sheet lists one button per node that has ships: "From Probe · 14", "From A5 · 8", plus "All · 22". On `rich` the buttons read "Attack from …". One tap sends `sendShips(from, to, 0)`, and "All" sends one `sendShips` per source. To retreat, select `probe` (or `a5`) and tap "From Rich".
- **Rally:** any node's sheet → "New ships gather here". The current rally node shows a flag.
- **Tuning panel:** the gear opens a full-screen list grouped by section. Each tunable has −/+ steppers (44 px) and a value field, clamped to its range, with "Reset to default" per row and for all. Changes apply live through `setTunable`. Toggles: result panel on/off.
- **Feedback:** the speech-bubble button opens a text box plus "Send". The note carries the build version, data version and replay (seed, data, input log). Delivery follows Q4 (prefilled GitHub issue link, with copy to clipboard if it is too long or the user has no GitHub account). Opening feedback pauses the game.
- **First-run hint:** a one-line dismissible banner, "Tap an asteroid to build an extractor", and nothing else.
- **Autosave:** every 5 s of wall time and on `visibilitychange` to hidden, to one localStorage slot. On load, resume silently. "New run" (in the tuning panel menu) asks for confirmation. If the save's data version doesn't match, discard it and say so in a toast.

#### Tunables (data/, all integers)

Rates are whole ore per game minute; times are in ticks (30 = 1 s at 1x); distances are in su. In the "Feels like" column, the first part describes the low end of the range and the part after "/" the high end. Map node positions, radii and slots are in `map.nodes` (table above) and need a restart to change.

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `economy.startStock` | 30 | 0–200 | 0: a slow cold start on probe mining / 200: skips the opening and the first decisions |
| `economy.probeOrePerMin` | 12 | 0–60 | 0: a bad start can stall for a long time / 60: asteroids feel optional |
| `extractor.cost` | 20 | 5–100 | 5: build everything at once, no choices / 100: each extractor is a big commitment |
| `extractor.buildTicks` | 300 | 30–1800 | 1 s: instant gratification / 60 s: sluggish, lots of waiting |
| `extractor.orePerMin` | 10 | 2–40 | 2: throughput barely moves / 40: routes are always the bottleneck |
| `node.bufferCap` | 40 | 10–200 | 10: bottlenecks show (and waste ore) quickly / 200: bottlenecks hide for minutes |
| `route.costBase` | 5 | 0–50 | 0: routes are free / 50: a route costs more than its extractor |
| `route.costPer100Su` | 2 | 0–20 | 0: distance is free / 20: far asteroids are rarely worth it |
| `route.buildTicks` | 300 | 30–1800 | as `extractor.buildTicks` |
| `route.podIntervalTicks` | 90 | 15–300 | 15: a near-continuous stream of dots / 300: sparse, lumpy deliveries |
| `route.podOrePerLevel` | 1 | 1–10 | sets capacity with the interval: 20/min per level at defaults |
| `route.podSpeedSu` | 6 | 1–30 | 1: far nodes take 30 s or more to start paying / 30: distance doesn't matter |
| `route.upgradeCostPerLevel` | 20 | 5–100 | 5: always upgrade / 100: live with bottlenecks |
| `route.maxLevel` | 5 | 1–10 | 1: no upgrades (slots are the only lever) / 10: never capped |
| `build.queueMax` | 4 | 1–8 | 1: one thing at a time, lots of tapping / 8: queue everything and forget |
| `ship.cost` | 15 | 5–60 | 5: ship swarms, the guardian is trivial / 60: few precious ships |
| `ship.buildTicks` | 90 | 15–900 | 0.5 s: production is pure throughput / 30 s: the shipyard, not throughput, is the throttle (bad for pillar 1) |
| `ship.hp` | 10 | 1–100 | 1: glass / 100: waves rarely lose ships |
| `ship.damage` | 2 | 1–20 | per round; sets the wave size needed |
| `ship.speedSu` | 4 | 1–20 | 1: about 30 s to reach the Bloom / 20: instant |
| `guardian.cap` | 12 | 1–40 | 1: a token guard / 40: a late-game wall |
| `guardian.thornHp` | 20 | 1–200 | how many ship-hits a thorn soaks |
| `guardian.thornDamage` | 3 | 0–30 | 0: free capture / 30: every wave is a massacre |
| `guardian.regrowTicks` | 60 | 15–1800 | 0.5 s: only huge waves win, trickles are hopeless / 60 s: regrowth irrelevant, chip it down over time (loses the puzzle) |
| `guardian.repairPerRound` | 2 | 0–20 | 0: damage sticks between rounds / 20: wounded thorns recover at once |
| `combat.roundTicks` | 30 | 10–90 | 10: fights are a blur / 90: slow, readable rounds |
| `rich.orePerMin` | 25 | 10–80 | per extractor: 10, capture barely matters / 80, capture dwarfs everything |
| `rich.freeExtractors` | 1 | 0–4 | 0: the payoff is delayed until you build / 4: instant full payoff |
| `stats.throughputWindowSec` | 60 | fixed | ring buffer size; not live-tunable |
| `client.autosaveSec` | 5 | 2–60 | client-only, not in the sim hash |

#### Success criteria (the owner, one ~20 minute phone session)

1. The first ship appears within about 2 minutes, with no help beyond the one-line hint.
2. Ore/min visibly climbs. By about 5 minutes the owner has upgraded a route because a node showed "backed up", and can say what the bottleneck was.
3. An attack before about 6–8 minutes (fewer than about 25 ships) visibly fails, and the battle report makes clear why: "regrowth outpaced me" or "too few ships".
4. A decent network takes the rich node at about 10–15 minutes, and ore/min then jumps by at least half within 2 minutes.
5. No mistaps or hunting for controls: every action is at most 2 taps from the map, and the owner never needs pinch, drag or hover.

**Bot tuning targets** (reports, not merge gates):
- turtle captures in 9–15 game minutes with 1–2 waves;
- rush's first wave fails;
- rush captures later than turtle, or loses at least 3× the ships;
- neither strategy softlocks;
- throughput is still rising at minute 10 for turtle.

#### Fun questions for the handoff

1. Watching ore/min climb and ships come faster: was that satisfying in itself, or did you only care about the attack?
2. When you took the rich node, did it feel like you worked out what it needed (how many ships, how much network), or like you just waited until you had a pile of ships?
3. Did the result panel (time to capture, ships lost) make you want to replay and beat it, or did it feel like a clock you didn't want?

#### Bot strategies (M1)

Both use only the inputs above. M1 has no randomness, so every seed gives the same game. That is expected; seeds still run for the determinism gate.

- **rush:** small economy, frequent waves, growing after each failure.
  1. Tick 0: `buildExtractor a1`, `buildRoute a1→probe`, then fill `a1` (2 slots).
  2. Fill `a2` (route plus 3 extractors), upgrading `a2`'s route when its extraction exceeds capacity.
  3. Shipyard on throughout; rally at `probe`.
  4. Whenever no ships are at or heading to `rich` and ships at `probe` ≥ `wave` (starting at 6), `sendShips(probe, rich, 0)`. Raise `wave` by 6 for each later wave.
  5. After capture, build out `rich` (extractors, route, upgrades).

  Model estimate: about 6 waves, about 78 ships lost, capture at about 25–30 minutes.
- **turtle:** economy first, one big wave.
  1. Tick 0: `setShipyard off`.
  2. For each node in order `a1, a2, a3, a4, a5`, keeping one queued item at a time: extractor, then route, then upgrade the route whenever extraction exceeds capacity, then fill the slots.
  3. When the plan is done: `setShipyard on` and `setRally a5`.
  4. When ships at `a5` ≥ 32, `sendShips(a5, rich, 0)`. If repelled, wait for 32 again.
  5. After capture, build out `rich`.

  Model estimate: capture at about 11 minutes in 1 wave, about 11 ships lost.

**Report** (per strategy and seed, in `reports/bots-latest.json` and the Markdown summary):
- capture time (game seconds, or null within the 30-minute cap) — this replaces win rate, and `outcome: won` means captured;
- first ship time;
- `throughputPerMin` at 2, 5, 10, 15 and 20 minutes, and peak;
- ships built and lost;
- waves sent and waves repelled;
- ore spent on ships vs economy;
- tick p50/p95.

The summary flags any strategy that never captures, and any whose capture time is outside the targets above.
