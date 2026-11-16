# Questions for the owner

Any agent may add a question. The owner answers inline under **Answer:**. The Director bundles open questions into each build handoff.

To approve a change to a protected file, the owner adds a line `APPROVED-PROTECTED: <path>` under the question.

## Build build-20261116-1 is ready (2026-11-15): H8, Hold the front

Play: https://factory4x.pages.dev (on your phone, portrait). Your old save is from data v13, so the game starts fresh.

What changed:
- Move ships by hand: drag from one rock to another to send its warships there. Long-press, then drag, to send half. Your warships now shield the rock they sit on: a raid must beat them before it can touch your mining ships, and haulers wait out the fight instead of flying in.
- Haulers are staffed by need: each mined rock gets as many as it needs, spares go home and are reassigned, and the probe stops building extras. Tap a rock to set its hauler count yourself (or leave it on Auto). A Mine mode marks several rocks quickly, and each weight row shows its share of your income.
- The raid's target rock now carries a badge. Tap the Fleet chip for a fleet panel showing every ship type, with Recycle to scrap ships you no longer need and free fleet slots.

Try this: when the first raid banner shows (about 2:40), drag your warships from the probe to the rock with the raid badge. Try a long-press drag to send half. Later, open the Fleet panel and recycle haulers you don't need to free slots for warships before you push for the hive.

Fun questions (the H8 hypothesis):
1. When a raid came, did you drag ships to meet it? Did moving ships feel quick, and did you use the long-press half move?
2. Did keeping warships on a rock feel like holding a front worth the slots, or like a chore?
3. Did you set any rock's hauler count, or did Auto get it right?

**Answered (owner, 2026-11-15):** 1, quick ("Moving ships felt quick"); the long-press half move isn't mentioned. 2, not much of a choice, because there's only ever one raid target, though repelling the first raid felt good. 3, Auto got it right; they wanted to dial extractors per rock instead. Scored against the success criteria in PLAYTEST_LOG.md (build-20261116-1).

Known from the team (not hidden from you):
- Drag and long-press were tested only in an emulated phone browser, not on a real phone. If a drag scrolls or misfires, say so; in the tuning panel, set "Move ships by" to 0 to switch to tap Move, then tap the target.
- A guard half the raid's size may still win (6 ships beat a full raid of 12, losing 3). If defending feels too easy, tell us; fun question 2 is where it shows.
- The bots that ignore raids finish about as fast as the ones that defend, so racing the economy may not feel risky yet.

Also open: Q18 (pillar 1 wording, only if a fleet cap ships). The fleet limit has shipped since H7, so it's worth a look now.
Protected files changed this build: none.

## Q24. Which way should the next build (H9) widen the front? (2026-11-15, Designer)

H8's controls worked: drag felt quick and Auto staffed the haulers right. But one raid target meant no choice, as you said. **Whatever you pick, this comes with it:** an extractor count per rock (−/+ on the rock sheet), replacing the hauler count. Haulers follow it on their own, as you expected.

Pick one:
- **A (recommended): a wider front.** Once your economy is big, a raid splits and hits the two mined rocks nearest the hive at once. You hold both, mine fewer exposed rocks, or let one go.
- **B: every nest raids.** The ice and crystal pockets raid the rocks nearest them too, so the front starts at home and moves out as you take each nest. About one and a half builds.
- **C: strike back.** Beating a raid leaves the hive short of those guards for about 90 s, so defending well opens a window to attack. Small, and it can join A.

Answer like "A", "A, plus C" (about a third of a build more), "B" or "C". Details: DESIGN.md → "H9 candidates (iteration 9)". Default if unanswered: A.

**Answer (owner, 2026-11-16, in chat):** "A, wider front". C is not included.

## Q23 (Blocking, 2026-11-15): GitHub Actions won't run

GitHub refuses to start any CI job on `tQuarella/factory4x`: "The job was not started because recent account payments have failed or your spending limit needs to be increased." Every run since 2026-11-14 23:25 failed in 2–4 s, including on main. Without CI, the H8 build can't merge or deploy. It's otherwise done: every task is Critic-approved, the gates pass, and the phone and desktop smoke runs pass 1370 of 1370.

**One step for you:** on GitHub, open Settings → Billing and plans and fix the failed payment, or raise the Actions spending limit. Then tell the Director "billing fixed".

**Answer (owner, 2026-11-15):** "Make repo public". The free 2,000 private-repo minutes for November were used up (about 270 runs). The Director scanned the full git history for secrets (none found), made `tQuarella/factory4x` public, and re-ran CI on e717b91.

## Build build-20261114-1 is ready (2026-11-14): H7, One field, live enemy

Play: https://factory4x.pages.dev (on your phone, portrait; 4x is fine). The bots take the hive in about 25–30 game minutes, so roughly 7–8 real minutes at 4x plus your decisions. Your old save is from an older data version, so the game starts fresh.

What changed:
- One asteroid field, one run: no overworld for now. The probe builds Extractor ships that mine a rock and Hauler ships that fly the ore home. Tap a rock and choose "Mine this rock" or "Stop mining". You land with economy only, so the first minute is about mining.
- No build queue: on the probe sheet, set a weight from 0 to 5 for each ship type (Extractor, Hauler, Drone, Lancer, Flak). The spider graph shows the split, and the probe spends its income in that ratio. The fleet limit is 30 ships, economy ships included.
- The hive raids you. Raids grow with your economy, never with time. A banner warns while a raid musters, and the raiders fly to the mined rock nearest the hive. Meet them with warships, or stop mining that rock. Take the ice and crystal pockets for Flak and Lancers, then take the hive to win.

Try this: grow the economy until the first raid banner appears (around 3 minutes in), then turn Drones up and rally them to the rock it names. Later, when you have a pocket's ship type, decide whether to keep adding extractors or turn the warship weights up and push for the hive. To compare, set "Raids" or "Economy ships count" to 0 in the tuning panel.

Fun questions (the H7 hypothesis):
1. Did you change the spider graph during the run? What made you change it?
   **Answered in part (owner's dictation, 2026-11-14):** yes, to pivot: "I have to, like, pull economy way back." The weights themselves weren't clear: "It's kind of unclear how this one to five… works."
2. Did the raids make you build a little force, or did they feel like a timer or a nuisance?
   **Answered:** they made them build force, and it was fun: "I guess I could do something to defend them" → "we fended off our first raid. That felt pretty good."
3. Was there a moment you chose between more economy and more offence? Which way did you go, and did it pay off?
   **Answered:** offence, and it paid off: "pull economy way back… Recycling haulers now… Destroyed the hive."

Scored against the success criteria in PLAYTEST_LOG.md (build-20261114-1).

Known from the team (not hidden from you):
- With the probe sheet open, the map is only about 200 px tall on a phone and the rings round the nearest rocks and the hive overlap. Close the sheet to see the field.
- Haulers keep flying to a rock while a raid hits it; "Stop mining" on the rock is how you pull them back.
- After you take a pocket, raids can still come for the rock nearest the hive. Raids never target the probe or retake rocks.

Also open: none.
Protected files changed this build: VISION.md (pillars 3 and 4, approved in Q21).

### Q22. Which fixes and features should the next build (H8) bring? (2026-11-14, Designer)

H7 worked: you defended a raid, liked the shared fleet limit, pivoted to offence and took the hive. **Whatever you pick, these come with it:**
- haulers staffed by what each rock needs (one at A1 and A2, not two or three);
- haulers rebalancing when they get home;
- no extra haulers built;
- an icon on the rock a raid is heading for;
- a fleet panel from the Fleet chip, with Recycle.

Then pick one:
- **A (recommended): a front worth holding.**
  - A hauler count per rock (Auto, or set it with −/+).
  - Warships at a rock keep its economy ships alive until they fall.
  - Haulers wait at home while a raid hits their rock.
  - A Mine mode: tap the button, then tap rocks to mark them.
  - Each weight shows its share of income ("3 · 30%").
- **B: move ships by hand.** Tap a rock, tap Move, tap where to go (drag as an option). Hold Move to split. Any ship type, haulers included.
- **C: the map returns.** The H6 overworld, with this ship economy and raids in every area. About two builds, and the fixes above would wait one area at a time.

Details: DESIGN.md → "H8 candidates (iteration 8)". Answer like "A", "A, plus B" (about half a build more), or "C". Also, if "Hate the economy stuff" meant you dislike the economy layer itself (I read it as "ate the economy stuff", the raid killing your haulers), say so in a word. Default if unanswered: A.

**Answer (owner, 2026-11-14):** "B, can we tap and drag to move ships?  Long-tap then drag to move half?"

*Director: B with the ride-alongs (hauler staffing by need, rebalance at home, no surplus haulers, raid target icon, fleet panel with Recycle). Gesture: drag from a rock to another moves all its ships of the chosen kind; long-press then drag moves half. "Hate the economy stuff" left as read (no correction).*

**Answer (owner, 2026-11-14, follow-up):** "Do A at the same time"

*Director: H8 is A and B together, with the ride-alongs.*

## Build build-20261108-5 is ready (2026-11-08): H6, the Open frontier

Play: https://factory4x.pages.dev (on your phone, portrait). A run to the probe core takes the bots about 46–62 game minutes, so roughly 12–16 real minutes at 4x plus your decisions. Your old save is from an older data version, so the game starts fresh.

What changed:
- A bigger overworld you drag to pan: 10 areas in four bands, and you need only some of them to win. Command relays replace Command limit research. Reclaim the first relay in a band and your fleet limit rises (12, then 20, then 28) and the next band opens. Locked areas are visible but can't be entered until then. A second area of the same kind pays half its haul. The Root is gone.
- Combat change: guards now strike the ship type they counter first ("Thorns strike Flak first; Spores strike Lancers first", shown on the sheets). A fight's outcome depends only on how many of each type you send, not on which yard finished first. This was a team call; say so if fights feel worse.
- Fixed: the top bar no longer jitters as resources change, and the "Backed up" warning no longer flickers or shifts the buttons under it. In phone landscape the chips no longer sit under the buttons.

Try this: take Frost Shelf or Glass Shoal, then its relay (Rime or Glint), and watch the map open band 2. Before you commit to a band 2 area, open its sheet and read the guard mix. Spore Veil and Thorn Garden sit next to the light areas: you can see them early but can't enter until you hold a relay. To compare, set "Band lock" to 0 in the tuning panel and try landing in one at a limit of 12.

Fun questions (the H6 hypothesis):
1. When you reclaimed a command relay and the next band opened, did that feel like a big step?
2. Did you skip an area, or pick one over another for a reason? Which, and why?
3. Did the map feel open, or still like one path? Did you miss the Root?

Known from the bots (not hidden from you):
- No bot ever takes a medium area (Spore Veil, Thorn Garden). They pay only resources for research, and the bots never need them. Whether you want them is question 2.
- Your ships don't heal, so a fleet that is exactly what a heart needs, sent right after the pocket fights, can be pushed back once. Bring a couple of spare ships, or recycle wounded ones.
- In phone landscape, the version tag in the corner can sit on an area name; drag the map a little.

Feedback: plain answers in chat work best.

Also open (none blocks anything): Q20 (pillar 3 wording now the Root is gone), Q12, Q10, Q3, Q4, Q5.

Protected files changed this build: none. Every merge passed the protected-files gate.

## Blocking

### Q21. Confirm the H7 scope and two pillar edits (2026-11-14, Designer)

Your spider-graph idea is the plan: the probe builds extractor and hauler ships, a spider graph splits its output across ship types instead of a build queue, and the hive raids what you build. Landing on the economy, and a first area you can't win without mining, come with it. Details: DESIGN.md → "H7 candidates". The three H6 questions are dropped, so there's no need to finish that run.

1. **Scope.** **A (recommended):** one field, one run, with the ship economy, the spider graph and raids. The overworld and research are parked until this proves fun. **B:** the same in every area of the current overworld. It's about twice the work, and harder to read if it fails.
2. **Pillars.** Raids conflict with two VISION.md pillars. Replace pillar 3 with "3. **Guardians have factories.** Mobs guard the best resources and raid what you build; their factories repair and replace up to a cap. Win a node by out-producing their replacement." (this also settles Q20). Replace pillar 4 with "4. **Pressure, not a clock.** Raids grow with what you build, never with time, so waiting never makes things worse. The challenge is balancing an efficient economy against the force that protects it."

Answer like "A, yes" (yes approves both edits; the Director applies them with a permission prompt), or give a letter and your own wording. Default if unanswered: A, with no pillar edit yet. Raids ship as an experiment with an off switch in the tuning panel, and the pillars are revisited after play.

**Answer (owner, in chat, 2026-11-14):** "A, yes"

APPROVED-PROTECTED: VISION.md (pillars 3 and 4 replaced with the wording above)

## Answered

### Build build-20261108-4 handoff (2026-11-08): H5, the Fleet cap. Answered in chat; see PLAYTEST_LOG.md

_Originally titled:_ Build build-20261108-4 is ready (2026-11-08): H5, the Fleet cap

Play: https://factory4x.pages.dev (on your phone, portrait). A full run to the probe core is about 40 game minutes, roughly 10–12 real minutes at 4x plus your decisions. Your old save is from an older data version, so the game starts fresh on the overworld.

What changed:
- A fleet limit: each area lets you field 12 ships at once (ships still being built count). A yard at the limit shows "idle: fleet full", and Recycle scraps parked ships for half their ore back so you can change your mix.
- New research, Command limit, raises the limit to 18, 24 and 30. Each level needs a harder area reclaimed first. Medium areas with their Root intact now need both Lancers and Flak at 18, and The Deep's intact heart needs 24.
- Fixed: the asteroid, pocket and heart sheets now show the extraction rate with your Extraction research applied. On phones the resource chips drop "/min" so the top bar fits in two rows.

Try this: take the two light areas with drones, then land in Spore Veil or Thorn Garden at a limit of 12 and open the heart's sheet before you commit. Try taking a medium heart with its Root intact once you have Command limit 1 (limit 18), using a Lancer and Flak mix, instead of cutting the Root first. If you want to compare with H4, set "Fleet limit (0 = none)" to 0 in the tuning panel.

Fun questions (the H5 hypothesis):
1. Did the ship limit make you think about which ships to build? Did you ever recycle ships to change your mix?
2. Was there an area you couldn't take until a limit raise, a better mix or a Root cut? Did that area feel stronger?
3. Did a limit raise feel like a big step?

Known from the bots (not hidden from you): the bots get around the limit by cutting every Root first and often take the heart with one ship type, so they never fight a heart that needs a mix. Whether the limit makes your mix matter is exactly what question 1 tests. The windows sit at their edges (both medium hearts need exactly 16 ships with the Root intact, two Deep layouts exactly 22), so one guard more or less changes what's open. A run is about 40 game minutes, no longer than with the limit off. A few sheets misread a counter tag: Spore Veil's heart with its Root cut says Even for Flak, which is actually Strong, and some small Twin Seams pockets read Even/Even where drones are the better pick (the first is logged as a backlog item). Also new on main since your last build: the extraction-rate display fix you reported.

Feedback: plain answers in chat work best. The speech-bubble button also opens a prefilled GitHub issue with a replay of your session.

Also open (none blocks anything): Q12 (eslint ignore for agent worktrees), Q10 (list secret names), Q3 (image service), Q4 (feedback delivery), Q5 (GitHub branch protection).

Protected files changed this build: none. Every merge passed the protected-files gate.

### Q19. Which slice should H6 test? (2026-11-08, Designer)

The fleet limit worked: you thought about your mix, recycled, and an area felt stronger. Two things didn't. A limit raise felt small, and cutting the Root was the only sensible play. They share one cause: a Root cut does the same job as a raise, so the raise only saves a fight. Details: DESIGN.md → "H6 candidates".

- **A. Open frontier with locked regions (recommended):** about 10–12 areas on a map you pan. The next region stays closed until you reclaim a command relay area, which raises your limit by 8 and opens the lanes on the map. You need only some of the areas. It's your open-world idea, built on the limit.
- **B. Keys, not amounts:** the same six areas. Command limit becomes two bigger levels, each the only key to a specific area, and the map shows what each one opened. Smaller, but it doesn't touch "too linear".
- **C. Node rigs** (your parked idea): later, not H6. It needs a VISION.md change ("not tile-by-tile belts"), and it's a second game in size.

**Rides along with A or B, from your Root suggestion:** keep the Root, but reward taking the heart with its Root alive. The Root is grafted and your fleet limit rises by 4 for the rest of the system. A cut is quicker; a graft gets you further. Say "remove the Root" instead if you'd rather.

Answer with a letter, plus "remove the Root" if you want that over the graft. Default if unanswered: A with the graft.

**Answer (owner, in chat, 2026-11-08):** A. Open frontier. Remove the Root (not the graft).


### Build build-20261108-3 handoff (2026-11-08): H4, the Reclaim ladder

Play: https://factory4x.pages.dev (on your phone, portrait). A full run to the probe core is about 46–51 game minutes, roughly 12–15 real minutes at 4x plus your decisions, so one 30–40 minute session should reach the win. Your old save is from an older data version, so the game starts fresh on the overworld.

What changed:
- A new overworld of six areas. You start with nothing at Landfall, an undefended field your first ship reclaims. Each area you reclaim pays a haul and keeps shipping resources home while you play.
- Research between areas makes you stronger for good: Lancer and Flak designs, more opening ore, faster extraction, seed rigs that land with an extractor already running, and faster yards.
- Ice areas are held by Spores, crystal areas by Thorns. Pick your next area by its guards and the designs you own, take The Deep, and build the probe core to win the system.

Try this: land in Landfall and reclaim it, then open Research and buy something before your next landing; notice what the landing notice says changed. After each area, open two or three area sheets and pick the next one by its guards, haul and the designs you own. Play through to The Deep and the probe core if you can.

**Owner's answer (2026-11-08, in chat):** recorded verbatim in PLAYTEST_LOG.md (2026-11-08, build-20261108-3). Areas didn't feel stronger; same max-economy-then-swarm approach; ice/flak obvious; no big step; overworld too linear; proposes a ship cap (raised by research) and a more open world; reports an extraction-rate display bug.

Fun questions (the H4 hypothesis):
1. Did getting stronger between areas feel good? Which upgrade did you notice when you landed in the next area?
2. After each area, was there more than one sensible next area? What decided it: a design you had, a prize, or the guard mix?
3. Did your third or fourth area feel like a fresh puzzle or a repeat of the first? Was there a moment that felt like a big step?

Known from the bots (not hidden from you): the best bot run is 45.8–47.6 game minutes, so it clears the 45-minute floor by under a minute on two seeds. Ice-first and crystal-first finish within 1% of each other, and four different area orders finish within 15% of the best. The bots buy both Fast yards levels and so take all six areas; if you go light on Fast yards you can win with five. The Deep on the Glass Thicket layout runs a little long (16:50 against a 16:00 target).

Feedback: plain answers in chat work best. The speech-bubble button also opens a prefilled GitHub issue with a replay of your session.

Also open (none blocks anything): Q12 (eslint ignore for agent worktrees), Q10 (list secret names), Q3 (image service), Q4 (feedback delivery), Q5 (GitHub branch protection).

Protected files changed this build: none. Every merge passed the protected-files gate.

### Q17. Which slice should the next build test? (2026-11-08, Designer)

Your H4 feedback has one root cause: every choice so far costs only time (ships are unlimited, so enough drones take anything). I steelmanned your open-world idea before agreeing. It fixes "linear" only if getting stronger means something you unlock; without a ship limit it makes "max economy then swarm" bigger. So I'd test your ship limit first. Details: DESIGN.md → "Owner direction 2026-11-08b" and "H5 candidates".

- **A. Fleet cap (recommended):** a limit on ships per area (start 12), raised by a Command limit research, plus a Recycle order to refit; areas recalibrated so drones alone can't fit. Same six-area overworld. Setting the cap to 0 in the tuning panel gives you H4 to compare.
- **B. Open frontier:** about 12 areas on a panned, scouted map; you need only about 7; repeat prizes pay less; an overworld Root that starves its neighbours. No ship limit.
- **C. Both, lite:** A plus 2–3 extra areas, two of which grant a cap raise instead of resources. Likely over one iteration's budget, and harder to read if it fails.

Answer with a letter. Default if unanswered: A.

**Answer (owner, 2026-11-08, in chat with the Director):** A. Fleet cap.

### Q18. Pillar 1 wording, only if a fleet cap ships (2026-11-08, Designer)

A fleet cap is a ceiling that throughput doesn't set, so it stretches pillar 1 ("gates everything else"). Replace

"1. **Throughput is the throttle.** The rate your network delivers resources to your factories and shipyards gates everything else."

with

"1. **Throughput is the throttle.** The rate your network delivers resources to your factories and shipyards gates how fast you build and rebuild; your fleet limit, raised by research, sets how much you can field at once."

Approve, edit or reject. It applies only if you pick A or C in Q17. Default if unanswered: no edit; the cap ships as an experiment under the current wording, with this question still open.

**Answer (owner, 2026-11-08, in chat with the Director):** No edit yet. The cap ships as an experiment; revisit the pillar after play.

### Build build-20261108-2 handoff (2026-11-07): H3, the Counter web

Play: https://factory4x.pages.dev (on your phone, portrait). Plan on one 30–40 minute session; 2x/4x is fine once your economy is running. Your old save is from an older data version, so the game starts fresh.

What changed:
- A new 16-node field in three layouts (Frost Gate, Glass Thicket, Twin Seams). Ice and crystal sit in guarded pockets across it: take a pocket, route its prize to the Probe, and it unlocks a new component and ship type.
- Two counter ships join the drone. Lancers (built with lenses, from crystal) pierce armoured Thorns; Flak (built with plating, from ice) shreds Spore swarms. Each hits its prey twice as hard and the other guard type at a quarter strength.
- Read a pocket before you commit: a two-colour ring shows its Thorn/Spore mix, its sheet tags your ships Strong, Even or Weak, and "Choose…" sends exactly the mix you want. The Root still feeds the Heart.

Try this: build your asteroid economy, then open the sheets of two or three pockets and pick your first one by its prize and its ring. When its prize reaches the Probe, a notice tells you which ship unlocked: turn that yard on at the Probe. Before each next pocket, check the Strong/Weak tags and use "Choose…" to send a mix. If you have time, tap New run after the Heart for a different layout.

**Owner's answer (2026-11-08, in chat):** recorded verbatim in PLAYTEST_LOG.md (2026-11-08 entry). The guard mix added real choice; logistics still simple; proposes an overworld of areas with persistent research as the progression loop.

Fun questions (the H3 hypothesis):
1. After your first pocket, did you have more than one sensible next target? What decided it?
2. Did the ring and the Strong/Weak tags tell you which ships to bring? Did you ever send the wrong ships, and did it sting?
3. Did unlocking a new ship type feel like a payoff? Did the game feel like one fixed sequence, or like a path you chose?

Known from the bots (not hidden from you): the game is a little faster than designed (the bots take the Heart in about 19–22 minutes, the spec aimed for 20–35). Ice-first and crystal-first openings finish within 1–2% of each other, though crystal-first is a few seconds ahead on every layout. On Twin Seams the tags read "Even" for both counter ships at the Root and Heart, so they give little guidance in that final fight.

Feedback: plain answers in chat work best. The speech-bubble button also opens a prefilled GitHub issue with a replay of your session.

Also open (none blocks anything): Q12 (eslint ignore for agent worktrees), Q10 (list secret names), Q3 (image service), Q4 (feedback delivery), Q5 (GitHub branch protection).

Protected files changed this build: VISION.md (Q14, owner-approved: long persistent game, pillar 1 wording). Every merge passed the protected-files gate.

### Q16. Which part of the overworld should the next build test first? (2026-11-08, Designer)

Your overworld idea fits VISION.md as written (no edit needed). Steelman: DESIGN.md → "Owner direction 2026-11-08: the overworld (steelman)"; details: "H4 candidates (awaiting the owner's pick)". Each is one build, reusing the H3 field inside every area:

- **A. Reclaim ladder (recommended):** 6 small areas on an overworld map, starting from one undefended area; reclaimed areas fill a stockpile that buys persistent research (Lancer and Flak designs, extraction, opening ore, faster yards) up to the probe core. Shipments are passive for now. Tests your progression loop and whether the grind stays minor.
- **B. Supply lines:** overworld lanes with capacity; you send each reclaimed area's output to the stockpile or into the area you're fighting in. No research yet. Tests overworld logistics.
- **C. Area runs with research:** no map; after each area, pick the next from 2–3 cards; research between areas. Cheapest, but drops the overworld and areas that keep producing.

Answer with a letter. Default if unanswered: A.

**Answer (owner, 2026-11-08, in chat with the Director):** A. Reclaim ladder.

### Q15. Skip a repeat branch CI run when `main` moved only in status files? (2026-11-07, Retrospective)

Before a browser-facing task merges, its branch must pass CI on the exact commit that gets merged. When `main` moves while that CI runs, the Director merges `main` again and waits about 4 more minutes, even if the only new commit on `main` edited `STATUS.md`. The process now asks the Director not to commit during that wait, so this happens less. Proposed on top of that: when the only files changed on `main` since the branch's green CI run are `STATUS.md`, `BACKLOG.md`, `QUESTIONS.md`, `DECISIONS.md`, `CHANGELOG.md`, `PLAYTEST_LOG.md` or `reviews/*`, merge without a new branch CI run. `merge-task` still runs every gate on the merged result, and CI runs again on `main` after the push. `DESIGN.md` and `ART_STYLE.md` would not count, because tests read them. This loosens a merge rule slightly, so it's your call. Default if unanswered: keep the current rule.

**Answer (owner, 2026-11-08, in chat with the Director):** "yes". Applied in PROCESS.md "Before merging".

### Q14. Two VISION.md edits for the asteroid-field direction (2026-11-07, Designer)

Your Q13 answer (a long, persistent game with factories outside the probe) conflicts with two lines in VISION.md. Steelman and reasoning: DESIGN.md → "Owner direction 2026-11-07: the asteroid field (steelman)". The first build (H3) doesn't depend on these, so it can start either way. Approve, edit or reject each:

1. Fixed decision. Replace
   "- A roguelite campaign: each star system is one 20–40 minute run; the campaign spans many sessions."
   with
   "- Each star system is one long game, played across many short sessions and kept by autosave. It ends when you launch a new probe; then new game+ in a richer, harder system."
2. Pillar 1. Replace
   "1. **Throughput is the throttle.** Delivery rate to the probe gates everything else."
   with
   "1. **Throughput is the throttle.** The rate your network delivers resources to your factories and shipyards gates everything else."

**Answer (owner, 2026-11-07, in chat):** "Approve both". Also chose "Build Counter web" as the first M2 slice (H3).

APPROVED-PROTECTED: VISION.md

### Q13. Which idea should the next build test? (2026-11-07, Designer)

Your H2 feedback showed two problems. Every run is the same sequence (build the economy, then ships, then attack), and the trade-offs were too small to feel. Cutting the Root was the fun part. Pick one (details in DESIGN.md → "H3 candidates"):

- **A. Fight to grow (Designer's pick).** Most asteroids start overgrown with small guards, so you fight from early on to grow your economy, and choosing which rock to take next is the puzzle. The Root feeds some of those guards too, so you get more satisfying cuts.
- **B. Prizes that change your factory.** Guarded nodes give you something new, such as a material for a tougher ship, instead of just more ore. What you take first changes how the rest of the run plays.
- **C. A new system every run.** A different generated map each time. It's fresher, but probably the same plan on a new map until A or B adds real choices.

**Answer (owner, 2026-11-07, in chat):** "Let's explore a more radical change:  a longer, persistent game across a large asteroid field.  Different types of resources, resource combos creating components, components adding new ship types.  Bloom in pockets across the field, guarding resources.  Stronger bloom over better resources requiring you to build more and stronger ships that need advanced components.  That becomes the progression loop.  The progression needs to feel somewhat varied rather than a straight line.  Consider some rock/paper/scissors type ship interaction with different types of bloom guards.  That would give choice in how you spread across the asteroid field and which resources you go for in what order.

Deeper logistics than just 'route to probe'  Consider:  components are made in factories outside the probe, there is a maximum route distance, anything else you suggest.

Steelman this."

Status: the Designer is steelmanning this direction (DESIGN.md). Parts of it may change VISION.md fixed decisions (for example run length), which would come back to you for approval.

### build-20261108-1 handoff (2026-11-07): H2, two ways to take the Bloom

Play: https://factory4x.pages.dev (on your phone, portrait). Plan on about 20 minutes for **two runs**: use 2x/4x once your economy is built, and tap New run after the first capture. Your old save is from an older data version, so the game will start fresh.

What changed:
- The Bloom now drinks from the Root, a smaller guarded stalk joined to it by a pink vine. Cut the Root first and the Bloom drops to 8 thorns and regrows 5× slower, so a smaller wave can take it. Or skip it and overwhelm the Bloom at full strength.
- Every run is one of three systems: Thin Root, Knotted Root and Deep Root. How strong the Root is changes which line is better, and New run moves you to the next system.
- Clearer battles: each battle line names its node, the Root and Bloom sheets show the Bloom fed and starved side by side, the result panel names the system and when you cut the Root, and taps on guarded nodes are easier to hit.

Try this: build up as before, then open both the Root's sheet and the Bloom's sheet before you attack, and decide whether to cut the Root first. After you take the Bloom, tap New run. The next system has a different Root; look again before you commit. (The bots found that cutting the Root first wins on Thin, the big wave wins on Deep, and Knotted is a trade-off: a little faster, but a few more ships lost.)

Fun questions (the H2 hypothesis):
1. Before your big attack, did you weigh cutting the Root against hitting the Bloom head-on? What tipped it, and did it feel like a real choice or an obvious one?
2. Your second run had a different Root. Did you change plan? Could you tell from the numbers on the sheets which way was better, or was it a guess? Did the new system make the replay feel fresh?
3. When the Root fell and the Bloom wilted, did that feel like a payoff in itself, or like a chore on the way to the real fight?

Feedback: plain answers in chat work best. The speech-bubble button also opens a prefilled GitHub issue with a replay of your session.

Also open: Q12 (eslint ignore for agent worktrees), Q10 (list secret names), Q3 (image service), Q4 (feedback delivery), Q5 (GitHub branch protection). None blocks anything.

Protected files changed this build: none. Every merge passed the protected-files gate.

**Answer (owner, 2026-11-07, in chat):** "Attacking the root first felt like the obvious choice.  Both runs felt the same: max economy then shift to building ships and attack once you have enough. Cutting the root was satisfying"


### build-20261106-2 handoff (Milestone 1 first playable, H1)

Play: https://factory4x.pages.dev (on your phone, portrait). Give it one ~20 minute session.

What changed:
- Build extractors and ore routes on five asteroids. Delivered ore per minute is the big number at the top, and your shipyard speeds up with it.
- The richest rock is guarded by the Bloom, a hive that regrows its thorns. Take it with one big enough wave, and your ore per minute jumps.
- Pause, 1x/2x/4x, a tuning panel for every number, a feedback button, and autosave so a closed tab loses nothing.

Try this: tap an asteroid and build an extractor, then a route. Grow the network until ore/min stops climbing, and upgrade the routes that show "!". Then try the Bloom: send an early wave and read the battle report, then come back with a bigger one. Pausing to plan an attack is fine. The bots take it in about 10 minutes with ~32 ships massed at A5.

Fun questions (the H1 hypothesis):
1. Watching ore/min climb and ships come faster: was that satisfying in itself, or did you only care about the attack?
2. When you took the Bloom, did it feel like you worked out what it needed (how many ships, how much network), or like you just waited until you had a pile of ships?
3. Did the result panel after capture (time, ships lost, waves) make you want to replay and beat it, or did it feel like a clock you did not want? (This is also Q11; it can be switched off in the tuning panel.)
4. "Attack with all" from two places arrives staggered, so the closer group fights first. Did you expect one combined wave?

**Answer (owner, 2026-11-06, in chat):** "Neat! The team did a great job of producing a functioning game. It was mildly satisfying but the solution was obvious and one dimensional. I wanted to replay but seeing the same exact setup was deflating. I didn't use attack with all."

Feedback: the speech-bubble button opens a prefilled GitHub issue with a replay of your session. Plain answers here or in chat work too.

Also open: Q12 (eslint ignore for agent worktrees), Q10 (list secret names), Q3 (image service), Q4 (feedback delivery), Q5 (GitHub branch protection).

Protected files changed this build: none. Every merge passed the protected-files gate.

### Q11. A result panel when you take the guarded node? (2026-11-06, Designer)

The first playable has no clock while you play. When you take the guarded node, it shows a small panel with game time to capture, peak ore per minute, ships built and lost, and waves sent. Then you can keep playing. The idea is a score to beat on a replay without any pressure during the run. `DESIGN.md` said to check with you before building a result screen. It ships on by default with an off switch in the tuning panel, and the handoff will ask how it felt. Answer here only if you already know you don't want it.

**Answer (owner, 2026-11-06, via build-20261106-2 feedback):** "I wanted to replay". Keep the result panel.

### Q9. Ask instead of block for all protected files (2026-11-06, Director)

You asked to act only when it must be you. Today, changing a protected file other than `VISION.md` needs you to edit it by hand. Proposed: move the `Edit` rules for `.claude/agents/critic.md`, `scripts/gates/**`, `.github/workflows/**` and `eslint.config.js` from `deny` to `ask`, as was done for `VISION.md`. After that, every protected change is a prompt you accept or reject, and the Director makes the edit. `.claude/settings.json` stays blocked. First uses: cw-gate-windows and cw-ci-hardening.

You have to apply this one yourself, because agents can't change their own permissions. The Director prepared the file; applying it is one command (given in chat).

**Answer (owner, 2026-11-06, in chat):** applied the prepared settings file, then: "Done, fix the gate"

APPROVED-PROTECTED: scripts/gates/protected-files.mjs

### build-20261106-1 handoff (Milestone 0 placeholder)

**Answer (owner, 2026-11-06, in chat):** "Visual direction is good. Everything is readable"

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

### Q20. Pillar 3 wording, now that the Root is gone (2026-11-08, Director)

Pillar 3 in VISION.md ends "Win a node by out-producing their replacement, or cut their supply first." You chose to remove the Root, so "cut their supply first" no longer describes the game. Suggested edit: drop that clause, so the pillar reads "Win a node by out-producing their replacement." This changes only the pillar text. VISION.md is protected, so it needs your yes. It blocks nothing; H6 goes ahead either way.

*Folded into Q21 part 2 (2026-11-14, Designer): its pillar 3 wording drops the same clause. Answering Q21 answers this.*

**Answer:** settled by Q21 ("A, yes", 2026-11-14); the clause is dropped.

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

### Q12. Ignore agent worktrees in eslint.config.js (2026-11-06, Director)

Agent worktrees live in `.claude/worktrees/` inside the repo. I scoped the `lint` script in `package.json` so they aren't linted, which works. The cleaner fix is adding `'.claude/**'` to the `ignores` list in `eslint.config.js`, which is protected. Approve with `APPROVED-PROTECTED: eslint.config.js` and I'll make that one-line edit (you'll also get the edit prompt).

**Answer:**
