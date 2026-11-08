# Vision

> **Status: signed off by the owner, 2026-11-06** (QUESTIONS.md Q7). First drafted by the Director from the owner's notes in `docs/HANDOFF_PLAN.md`, then revised in a design session with the owner. Agents propose changes in `QUESTIONS.md`; the Director applies a change only after the owner approves it, through a per-edit permission prompt.

## The fantasy

You are a von Neumann probe arriving in a new star system. Everything you will ever have starts with what you can pull out of the rocks around you. Grow from one probe into an industrial presence that can fight for the system's best resources, then build a new probe and send it onward.

## The owner's original note

- Extract resources and build components that go back to the probe, which builds ships to do the other 3X (explore, expand, exterminate).
- The system has inhabitants (mobs) that guard the good stuff. Better stuff means harder mobs.
- The rate of resources delivered to the probe sets the rate of ship production.
- Research components and ships.
- Mobs have their own factories, so you must outpace and overpower them to gain ground.
- You win when you build a new von Neumann probe. Then new game+.

## Fixed decisions

- Real-time, with pause and 1x/2x/4x speed.
- A fun prototype for the owner and close friends, shared by a public link. Not a commercial release.
- Playable on a phone browser. Logistics are abstract routes between nodes, not tile-by-tile belts.
- Generated art, coherent with a style guide.
- Each star system is one long game, played across many short sessions and kept by autosave. It ends when you launch a new probe; then new game+ in a richer, harder system.
- No fail state. You can lose ships and time, never the run.
- Ships take orders at nodes (attack, guard, escort); no unit micro.
- Autosave, so a run survives a closed tab.

## Design pillars

1. **Throughput is the throttle.** The rate your network delivers resources to your factories and shipyards gates everything else.
2. **Risk scales with reward.** The best resources are the best guarded; taking them costs ships, and a bad commitment wastes production.
3. **Guardians have factories.** Mobs only defend, but they repair and replace up to a cap. Win a node by out-producing their replacement, or cut their supply first.
4. **A puzzle, not a race.** No clock and no pressure. The challenge is building an efficient network.
5. **Every system makes the next one stronger.** Research and probe design carry forward, and each new system is richer and harder.

## Approved protected changes

<!-- The owner adds lines here or in QUESTIONS.md of the form: APPROVED-PROTECTED: <path> -->

- 2026-11-06: revised fixed decisions and pillars (QUESTIONS.md Q7). APPROVED-PROTECTED: VISION.md
