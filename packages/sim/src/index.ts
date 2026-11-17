/**
 * @factory4x/sim — the deterministic game simulation (DESIGN.md H1, H2's Root and supply, H3 "Counter web",
 * H4 "Reclaim ladder": the campaign of areas around them, H5 "Fleet cap", and H6 "Open frontier": command relays,
 * band locks, scouting and repeat hauls on a ten-area map).
 *
 * PUBLIC API. The client, bots and tests depend only on what this file
 * exports. Treat it as stable: add, don't rename or remove, without a
 * DECISIONS.md entry (the H3 changes are logged under "h3-sim", the H4 ones under "h4-sim", the H5 ones under "h5-sim",
 * the H6 ones under "h6-sim").
 *
 * Lifecycle
 *   defaultData                     validated data/sim.json (tunables, map.nodes, map.layouts, map.areas, map.lanes, research).
 *   parseSimData(raw)               validate other data (e.g. a feedback replay's) → SimData; throws on bad data
 *                                   (H6: including the haul invariant: Σ haul with every area of a repeat group at its
 *                                   decayed haul (areas.repeatHaulPct default) < Σ research cost per resource at the
 *                                   research.costPct max; a relay outside tiers 1–2; an area outside OVERWORLD_FRAME;
 *                                   a band locked by default with no relay in the band below; the removed `fleet` item).
 *   createWorld(seed, data)         fresh campaign at tick 0, ON THE OVERWORLD (no area active: world.nodes is empty).
 *                                   The Deep's layout is system.variant − 1 if that tunable's default is > 0, else
 *                                   ((seed mod 3) + 3) mod 3 (chooseVariant); world.system and campaign.deepLayout name it.
 *   campaignWorld(seed, data, start)   TEST/TOOL/DEV-HOOK ONLY: a campaign as if `start.reclaimed` (area ids) were
 *                                   reclaimed and `start.research` ({id: level}) bought, with `start.stockpile`;
 *                                   `start.land` (a lane-open area id; H6: band locks are not checked, so tools can land
 *                                   behind one) lands there at tick 0. Start areas record haulPaid 0. Not reachable by inputs.
 *   step(world, data, inputs)       advance one tick (mutates world); inputs apply first, invalid ones are ignored.
 *                                   No area active: inputs only, then tick + 1 (the overworld is paused).
 *   worldHash(world)                8-hex fingerprint of all state (the campaign included).
 *   replayHashes(replay, data, ticks, every)   hashes every `every` ticks of a replay (replay.start, if set, starts it
 *                                   from campaignWorld instead of createWorld; tools and dev hooks only).
 *   serializeWorld(world)           save string (plain JSON).
 *   deserializeWorld(text, data)    LoadResult; refuses a different dataVersion ('dataVersion') or a malformed save
 *                                   ('corrupt', which includes a bad campaign shape).
 *
 * Campaign (H4; world.campaign, plain JSON). Areas, lanes and research are indexed in data order.
 *   campaign.active                 index into data.map.areas of the area being played, or null on the overworld.
 *   campaign.areaStartTick          tick of the current landing; area times are tick − areaStartTick.
 *   campaign.areas[i]               {reclaimedTick, entries, withdrawals, playTicks, reclaimPlayTicks, shipsBuilt, shipsLost,
 *                                   shipsRecycled, oreRefunded, haulPaid} (H5: the recycle totals, recorded with shipsBuilt;
 *                                   H6: haulPaid, what the reclaim paid, or null while held).
 *   campaign.reclaimOrder, research {id: level}, researchLog [{item, level, tick}], stockpile, shipAccum,
 *   totals {hauled, shipped}, wonTick (non-null after the probe core: only setTunable is valid then).
 *   The area fields (stock, nodes, routes, ships, guardians, yards, stats, capturedTick, ...) hold the active
 *   area, with its node subset in frame order (probe = 0); on the overworld they are empty.
 *   Capturing the heart reclaims the area (pays its haul once). Rule 10 ships Σ export × shipments.pct of the
 *   reclaimed areas into the stockpile while a held area is played (integer accumulators).
 *
 * Open frontier (H6; all derived from reclaim records, data and live tunables, never stored)
 *   data.map.areas[i].side ('ice' | 'crystal' | 'none') and .relay (a command relay; tiers 1–2 only). Band = tier.
 *   commandedBands(world, data)     bands (of 1, 2) with a reclaimed relay; a relay reclaimed in the active area counts
 *                                   from the next landing (the limit never rises mid-area). A second relay in a band adds
 *                                   nothing. maxCommandedBands(data): bands that have a relay (2 shipped).
 *   bandOpen(world, data, b)        b ≤ 1, or overworld.bandLock 0, or a relay of band b − 1 commanded.
 *   isLaneOpen(world, data, a)      H4's lane rule alone (held, and tier 0 or lane-joined to a reclaimed area).
 *   isAreaOpen(world, data, a)      enterable: isLaneOpen and bandOpen(its tier). enterArea checks it (the band lock).
 *   isKnown(world, data, a)         scouted: tier 0, reclaimed, or lane-joined to a reclaimed area (else "far").
 *   repeatOf(world, data, a)        the group mate (same tier and side, side ≠ none) reclaimed before it, or null.
 *   haulIfReclaimedNow(world, data, a)   its haul, or floor(haul × areas.repeatHaulPct / 100) per resource for a repeat.
 *                                   The reclaim pays exactly this and records it as haulPaid. Exports never decay.
 *
 * Inputs (the `Input` union; node params are node indices, see world.nodes)
 *   enterArea{area}                 H4: land in an open area (held, and the tier-0 start or lane-joined to a reclaimed
 *                                   area; H6: and its band open). Valid on the overworld, before the win.
 *   leaveArea{}                     H4: back to the overworld; a withdraw (the area resets) if its heart isn't captured.
 *   buyResearch{item}               H4: next level of data.research[item], paid from the stockpile. Overworld only,
 *                                   before the win, below max, requirements met, affordable.
 *   Every input below except setTunable is valid only while an area is active.
 *   buildExtractor{node}            asteroids, captured pockets, the captured heart.
 *   buildRoute{from,to} upgradeRoute{from} cancelBuild{index} setRally{node} setTunable{key,value}
 *   setShipyard{shipType,on}        one yard per ship type ('drone' | 'lancer' | 'flak'); valid in any area. A lancer or
 *                                   flak yard only starts builds once its design is researched (H4 design gate).
 *   sendShips{from,to,counts}       counts = {drone, lancer, flak}, each an integer ≥ 0, clamped to the ships of
 *                                   that type at `from` (pass shipsAtByType(world, from) or SEND_ALL to send all).
 *                                   Valid if from ≠ to and the clamped total is ≥ 1.
 *   recycleShips{node,counts}       H5: scrap ships parked at `node` (not in transit), counts clamped as sendShips,
 *                                   lowest ids first. Valid at any node but a living guarded node, if the clamped
 *                                   total is ≥ 1 (also while fleet.cap is 0). Each ship adds
 *                                   floor(ship.<type>.cost × fleet.recycleRefundPct / 100) ore to stock; its
 *                                   component is lost. stats.shipsRecycled (per type) and stats.oreRefunded count it.
 *   buyResearch{item}               H5: checks {tier, count} requirements (≥ count reclaimed areas of tier ≥ tier); a
 *                                   requirement's `atLevel` limits it to that level. H6 removed Command limit (`fleet`):
 *                                   parseSimData rejects it, so its capOff rule never applies.
 *   isValidInput(world, data, input)   would `step` accept it now? (grey out buttons with this)
 *   inputCost(world, input)            ore the build order would lock if queued now (0 for non-builds).
 *   clampSendCounts(world, from, counts)   what a sendShips order would really send.
 *
 * Map (H3; H4 areas use a subset in the same frame order): node 0 probe, a1-a9 asteroids, p1-p4 pockets, root, heart.
 *   Outside The Deep, find nodes by id (world.nodes[i].id), not by fixed index. world.guardians has one guardian
 *   per pocket, the Root and the heart, in node order. Each guardian holds Thorns and Spores (`guards`,
 *   id order) and its layout counts; caps are capEff(count) = min(60, floor(count × guard.capPct / 100)).
 *   Capturing the Root starves the heart (guardian.fed = false): it wilts to its starved caps, newest first.
 *   world.stock = {ore, ice, crystal, lens, plating}; world.yards and world.assemblers are at the probe.
 *   Yards (rule 5b): lancer and flak start before drones and take turns (world.yardTurn indexes YARD_ROTATION:
 *   the component yard tried first; each start passes the turn on), so neither starves the other when ore is short.
 *
 * Fleet limit (H5, H6; derived, never stored)
 *   fleetCap(world, data)           fleet.cap + fleet.relayStep × commandedBands, or null when fleet.cap is 0
 *                                   (no limit: exactly H4's rules; relays still open bands). On the overworld: the next
 *                                   landing's limit. isFleetFull(world, data): a limit is set and fleetCount reached it.
 *   fleetCount(world)               world.ships (parked, in transit, fighting) + yards with a ship in progress.
 *   A yard starts only while fleetCount < fleetCap (recomputed after each start in the tick); a yard held by the
 *   limit keeps its round-robin turn. Ships are never removed to meet the limit (lowering fleet.cap live only
 *   pauses the yards). Battle.capAtSend (and so BattleResult/lastBattle) is the limit the wave was sent at, or null.
 *
 * Selectors (read-only; rates needing a decimal are in tenths, `…X10`)
 *   isCaptured(world), isRootCut(world)   heart captured? / Root cut?
 *   throughputPerMin(world)         ore delivered by routes over the last 60 s (headline HUD number, ore only).
 *   prizePerMin(world)              {ice, crystal} delivered over the last 60 s (small, under their chips).
 *   incomePerMin(world)             ore throughput + probe mining.
 *   shipsPerMinX10(world, type?)    ships/min ×10 one yard sustains at current ore income (0 if off).
 *   unlockStatus(world)             which resource chips and ship rows to show (hidden until first delivered).
 *   shipCounts(world)               ships at / en route to each node, total and by type; byType = HUD ship chips.
 *   shipsAtByType(world, node)      ships of each type parked at a node (send panel defaults).
 *   nodeStatus(world, node)         prize, extractors, extraction/min, buffer, backedUp, noRoute, route level/capacity.
 *   routeCapacityPerMin(world, lvl) units/min a route of that level carries.
 *   queueStatus(world)              unpaid orders, reserved ore, active build progress.
 *   yardStatus(world, data)         Yards block: per type on/off, unlocked (resource delivered here), researched (design),
 *                                   progress, cost, component, state ('building' | 'needsDesign' | 'noSource' | 'off' |
 *                                   'fleetFull' | 'needsComponent' | 'needsOre' | 'ready'); rally; probe mining.
 *   fleetStatus(world, data)        H5: {cap (null = off), count, building, byType, buildingByType, full}; H6:
 *                                   commandedBands and maxCommandedBands (level and maxLevel are deprecated, always 0).
 *   recycleRefund(world, counts)    H5: ore those counts would refund, as given (pass clampSendCounts(world, node, c)).
 *   assemblerStatus(world)          Assembly block: per component stock/cap, recipe, progress, state
 *                                   ('making' | 'full' | 'needsInput' | 'needsOre' | 'ready').
 *   guardianStatus(world, node)     a guarded node's sheet: prize, slots, rate, guard rows per type (count, cap,
 *                                   regrow, hp, damage, repair), guard hps for the ring, supply, and `tags`:
 *                                   Strong/Even/Weak per ship type (guard-hp-weighted, integer, division last).
 *   weightedMultPct(tun, ship, counts), counterTag(tun, ship, counts), tagFor(ship, pct)
 *                                   the tag math for any guard mix (bots pass capEff counts).
 *   supplyStatus(world)             hasRoot, Root alive, fed/starved, Root cut tick, the heart's fed and starved caps/regrow/repair.
 *   systemStatus(world)             layout index, id and name ("Frost Gate"), Root cut tick and second.
 *   combatRates(world, node, fleet) guards stripped per s ×10 for a fleet {drone, lancer, flak} vs regrowth per s ×10.
 *   battleStatus(world, node)       the battle running at that node with live guard counts and rates, or null.
 *   activeBattles(world)            every running battle, node order (banner lines).
 *   lastBattle(world, node)         the last finished battle there (toasts): guards at start, ships engaged/lost
 *                                   by type, guards killed by type; a Root capture carries `wilt` {from, to}.
 *                                   world.lastBattle is the latest at any node.
 *   runSummary(world)               heart capture time, capture order, ships built/lost/recycled by type, ore refunded,
 *                                   waves, ore spent, haulPaid (H6: the area result's haul, decayed for a repeat),
 *                                   layout, Root cut, withered, delivered and first-delivered per resource, per target.
 *                                   Every `…Sec` is area-relative (since the landing); `…Tick` fields are world ticks.
 *   campaignStatus(world, data)     overworld HUD: active area, stockpile, shipPerMinX10, shipping, reclaimed count,
 *                                   wonTick, research levels.
 *   areaStatus(world, data, area)   area sheet: id, name, tier, x/y, state ('locked' | 'open' | 'reclaimed' | 'active'),
 *                                   lanes, haul (nominal), export, guarded nodes (caps, starved caps), hasRoot, heartTags
 *                                   {lancer, flak} with `researched`, and the visit record; H6: plus areaFrontier's fields.
 *   areaFrontier(world, data, area) H6: {known, open, locked (its band), lockReason (null | 'lanes' | 'bandLocked'), relay,
 *                                   band, side, commanded (a relay of its band is reclaimed), bandOpen, unlockRelays (the
 *                                   band-below relays when locked), haulNow (would pay now / paid), haulDecayed, repeatOf,
 *                                   capAfter (the limit after reclaiming it)}.
 *   overworldStatus(world, data)    H6: {areas: per area {index, id, name, reclaimed, ...areaFrontier}, commandedBands,
 *                                   maxCommandedBands, fleetCap, bandLock}.
 *   researchStatus(world, data)     research sheet rows: level/max, next cost (after research.costPct), affordable,
 *                                   missing {resources, items, areas, tiers [{tier, count, have}], capOff}, canBuy,
 *                                   effect and nextEffect (numbers).
 *   landingEffects(world, data)     openingOre, rigNodes, extractPct, yardTimePct, designs, fleetCap (the landing notice).
 *   campaignSummary(world, data)    win panel / bots: per area records, reclaim order (with haulPaid), research order,
 *                                   total play ticks, ships built/lost/recycled, ore refunded, hauled (paid) and
 *                                   shipped, haulNominal (H6: Σ data haul of the reclaimed areas).
 *   isAreaOpen(world, data, area), isWon(world), yardBuildTicks(world, type), extractPct(world), yardTimePct(world).
 *   nodeDistance(world, a, b)       integer distance used for routes and travel.
 *   heartIndex(world), rootIndex(world), PROBE   node index of the heart / the Root / the probe (always 0).
 *   guardianAt(world, node), isGuarded(world, node)   the guardian at a node (or null) / is it alive.
 *   capEff(n, capPct), guardCaps(world, g), countGuards(g)   effective caps and live counts per guard type.
 *   counterPct(tun, ship, guard)    the raw damage multiplier (strongPct, weakPct, or 100 for drones).
 *
 * Constants: SHIP_TYPES, GUARD_TYPES, RESOURCES, RAW_RESOURCES, COMPONENTS, COMPONENT_INPUT, SHIP_COMPONENT,
 *   YARD_ORDER, YARD_ROTATION, COMBAT_ORDER, TAG_STRONG_PCT, TAG_WEAK_PCT, GUARD_CAP_MAX, SEND_ALL,
 *   AREA_SIDES, RELAY_TIERS, OVERWORLD_FRAME (H6: x 0–1000, y 0–2100), REMOVED_RESEARCH_IDS.
 *   Data helpers (H6): sameHaulGroup(a, b), decayedHaul(haul, pct), worstHauls(areas, pct).
 *
 * Tuning
 *   TUNABLE_KEYS, tunableMeta(data) every tunable: key, section, default, min, max, live, scope, newRunOnly.
 *   setTunable inputs change world.tun from that tick on; they are in the replay log, so replays reproduce tuned sessions.
 *   client.* tunables are client settings (scope 'client'): setTunable ignores them.
 *
 * Field mode (H7 "One field, live enemy"; the h7-sim changes are logged under "h7-sim")
 *   data.run.mode                   'field' | 'campaign' (absent: campaign). runMode(data) reads it; withRunMode(data, mode)
 *                                   returns a copy with it set (tests and tools play the parked campaign on shipped data
 *                                   with withRunMode(defaultData, 'campaign')). campaignWorld throws on field data.
 *   data.map.field                  {nodes, mine, layout}: the field's frame node ids, the asteroids Mine-marked at the
 *                                   landing, and its guards (area layout format, no Root). parseSimData checks it, and in
 *                                   field mode ship.hauler.cargo ≤ node.bufferCap and economy.probeOrePerMin ≥ 1 (defaults).
 *   createWorld(seed, fieldData)    lands straight in the field (F13): the area fields hold it, campaign.active stays null,
 *                                   world.field is set (isField(world)); stock economy.startStock; weights alloc.start.*,
 *                                   warships 0; rally the probe. isWon(world) is true once the hive (the heart) falls;
 *                                   free play continues and inputs stay valid.
 *   world.field                     {alloc, share, allocCur (per BUILD_TYPES type), bays (extractor, hauler; the warship
 *                                   bays are world.yards, `on` unused), econ (EconShip[], id order), mine, free and
 *                                   rockBuckets (per node)}. EconShip {id, type, hp, at, transit, target (extractor: bound
 *                                   node; hauler: assigned node), cargo, cargoRes}. Economy ships are NOT in world.ships
 *                                   (warships only), so every H3–H6 path over world.ships is unchanged. Node.extractors
 *                                   is derived in field mode: free + docked extractor ships.
 *   world.raid, world.nextRaidTick  R1 (DESIGN.md H7 "Raids"): null / 0 at the landing; src/factions/ (h7-raids) runs them, and world.lastRaid is the last raid result.
 *   stats                           H7 adds econBuilt, econLost, econRecycled ({extractor, hauler}), raids {mustered,
 *                                   beaten, hit, turnedBack}, allocChanges, peakEcon (zero in a campaign).
 *   Per tick (field): F1 inputs, F2 allocation (smooth weighted round robin, 1 ore at a time), F3 bays (finish, then
 *   start; F9 limit), F4 extraction, F5 extractor dispatch, F6 haulers, F7 movement, F8 raid hook, F10 combat,
 *   F11 capture (Mine-marks the node, free extractors; the hive sets capturedTick), regrowth, stats.
 *   Inputs (field)                  setAlloc{shipType: BuildType, weight 0..alloc.maxWeight} (at 0 the share returns to
 *                                   stock), setMine{node, on} (an asteroid, or a captured pocket or hive), sendShips
 *                                   (warships only), recycleShips{node, counts: RecycleCounts} (optional extractor and
 *                                   hauler counts), setRally, setTunable. Every campaign input is invalid in field mode.
 *   fleetCap / fleetCount / isFleetFull   field: field.fleetCap (0 = no limit); counted ships alive + counted bays
 *                                   building; every type counts when fleet.countsEconomy is 1, warships only when 0
 *                                   (isCountedType). fleetStatus adds countsEconomy, econByType, econBuildingByType.
 *   allocStatus(world, data)        probe sheet: rows per type {weight, share, cost {ore, resource}, unlocked, building
 *                                   0–100, ticksLeft, totalTicks, state: off | locked | filling | waitingResource |
 *                                   fleetFull | building}, maxWeight, stockOre, incomePerMin.
 *   rockStatus(world, node)         rock sheet: mine, mineable, docked, bound, inFlight, slots, freeExtractors, haulers,
 *                                   buffer, bufferCap, backedUp, deliveredPerMin (60 s), raidRank (h7-raids).
 *   fieldSummary(world)             result panel: capturedTick, timeToHiveSec, peakPerMin, built/lost/recycled per
 *                                   BUILD_TYPES type, raids, econLostToRaids, allocChanges, peakEcon.
 *   guardPools(tun, guards), guardStrike(pools, warships, econ?)   rule 7's guard damage (H6 amendment), shared by F10
 *                                   and the raid fight (R7): warships in GUARD_TARGET_ORDER, then haulers, then extractors.
 *   oreCost, resourceCost, isTypeUnlocked, isMineable, isMarkable, isWorked, econAtByType, econAlive   field helpers.
 *   FIELD_PARKED_KEYS               the tunables unused in field mode (the tuning panel hides them).
 *
 * H8 "Hold the front" (the h8-sim changes are logged under "h8-sim")
 *   world.field.haulerSet           per node: the hauler count the player set (setHaulers), or null for Auto. Saved.
 *   Haulers (hauler.autoNeed 1)     H1 need max(1, ceilDiv(yieldPerMin × roundTrip × hauler.needPct, 100 × T × cargo))
 *                                   for a haulable (worked, Mine-marked) node, else 0; target = set count (capped at
 *                                   rock.haulerMax) or the need. H2: a hauler at the probe with no node takes the largest
 *                                   shortfall (target − assigned) above 0, ties nearest the probe then lower index, or
 *                                   idles at the probe. H3: arriving at the probe over its node's target, it leaves the
 *                                   node and picks again. H4: the Hauler is eligible in F2 (and its bay starts) only while
 *                                   haulerShortfall > 0 (Σ max(0, target − assigned) − idle haulers − a hauler in the bay).
 *                                   hauler.autoNeed 0 is H7's F6 exactly.
 *   H1 amendment                    the need, target, shortfall, pick and bay use STAFFED nodes: Mine-marked and haulable,
 *                                   or with an extractor counted by staffCounts (ships bound there, docked or flying in,
 *                                   plus the committed ones: the bay's and a full share's, at F5's next pick). yieldPerMin
 *                                   counts them plus free extractors. A hauler at a staffed node not yet worked waits.
 *   haulerNeed / haulerTarget / isHaulable / isStaffed(world, node), haulerShortfall(world)   the H1–H4 numbers.
 *   haulersHeld(world, node)        H10 hook in src/factions (h8-raids implements it; false until then): runHaulers keeps
 *                                   a held node's haulers at the probe and sends one at the node home with what is there.
 *   Inputs (field, H8)              moveShips{from, to, part: 'all' | 'split'}: the warships at `from` (all, or per type
 *                                   floor(count × move.splitPct ÷ 100), 1-ship fallback), computed when it applies, then
 *                                   a sendShips. setHaulers{node, count: null | 0..rock.haulerMax} (an asteroid, or a
 *                                   captured pocket or hive). recycleFleet{counts: all five types}: recycleOrder per type
 *                                   (idle at the probe, parked or docked by node index, in transit; lowest id first; not
 *                                   at a living guarded node or a fighting raid's target), each refunding as recycleShips.
 *   movePreview(world, from, part)  the counts a moveShips would carry now (the drag ghost).
 *   recycleOrder(world, type)       the ships recycleFleet would take, in order.
 *   allocStatus rows                gain incomePct (floor(weight × 100 ÷ Σ weights of unlocked types above 0); 0 off or
 *                                   locked) and the state 'enough' (the Hauler while no rock is short; the Extractor while
 *                                   no Mine-marked rock has a free slot, extractorShortfall ≤ 0; hauler.autoNeed 1 only).
 *   rockStatus                      gains haulerNeed, haulerSet, haulerTarget, raidTarget and haulersHeld (h8-raids).
 *   fleetStatus.types               per BUILD_TYPES type {alive, idle, building (0/1), recyclable}.
 *
 * H9 "A wider front" (h9-sim: the extractor dial and the prong selectors' final shape; data v15)
 *   world.field.extractorSet        per node: the extractor count the player set (setExtractors), or null for All. Saved.
 *   setExtractors{node, count}      X1: an asteroid, or a captured pocket or hive; count null (All) or
 *                                   extractorMinCount(world, node) (1; max(1, free) for a pocket or the hive)..slots.
 *                                   Kept while the rock is unmarked. X3: lowering unbinds the surplus on that tick
 *                                   (in flight first, then docked, highest id first); F5 re-dispatches it.
 *   extCap(world, node)             X2: extractorSet, else the slots. F5's dispatch, H4b's free slots
 *                                   (extractorShortfall) and the committed extractors (staffCounts) read it.
 *   stats.raidProngs                W6: prongs by outcome {beaten, hit, turnedBack}; fieldSummary.raidProngs.
 *   raidStatus                      gains prongs (per prong: target, phase incl. 'done', planned, raiders,
 *                                   ticksToArrival, outcome, holding) and nextProngs; last (RaidResult) gains prongs
 *                                   (per prong: target, outcome, lostEcon, lostShips, killed). The legacy fields keep
 *                                   their one-prong meaning. h9-raids: one entry per prong of world.raid (prong 0 is the raid object itself, prongs 1 and up are world.raid.others; raidProngs(raid) lists them).
 *   rockStatus                      gains extractorSet, extCap, raidMix (the prong aimed here: plan, then raiders) and
 *                                   raidNext (raidable with raidRank ≤ nextProngs).
 *   raid.prongsMax / raid.prongMinSize / client.haulerStepper   the v15 keys (the client key never reaches the sim).
 *
 * Reading `World` fields directly is fine (it is plain data); never mutate it outside `step`.
 * Time: `world.tickRate` ticks per game second (30). Ships in transit: interpolate from
 * `ship.transit.{from,to,ticksLeft,totalTicks}`; pods from `route.pods[].ticksLeft` and
 * ceil(route.length / route.podSpeedSu).
 */
import simData from '../../../data/sim.json' with { type: 'json' };
import { parseSimData, type SimData } from './data.ts';
import type { ShipTypeCounts } from './world.ts';

export {
  AREA_SIDES,
  BUILD_TYPES,
  COMBAT_ORDER,
  COMPONENTS,
  COMPONENT_INPUT,
  ECON_TYPES,
  FIELD_PARKED_KEYS,
  GUARD_CAP_MAX,
  GUARD_TYPES,
  OVERWORLD_FRAME,
  RAW_RESOURCES,
  RELAY_TIERS,
  REMOVED_RESEARCH_IDS,
  RESEARCH_IDS,
  RESOURCES,
  RIG_NODES,
  RUN_MODES,
  SHIP_COMPONENT,
  SHIP_TYPES,
  TUNABLE_KEYS,
  YARD_ORDER,
  YARD_ROTATION,
  appliesAtLevel,
  decayedHaul,
  isTierRequirement,
  parseSimData,
  runMode,
  sameHaulGroup,
  tunableMeta,
  withRunMode,
  worstHauls,
} from './data.ts';
export type { BuildType, EconType, FieldMap, RunMode } from './data.ts';
export { dealCounts, haulersHeld, isRaidable, launchMix, nextProngs, prongCount, prongOutcome, raidFightsAt, raidKeep, raidMix, raidMixAt, raidProngs, raidRank, raidSize, raidStatus, raidTarget } from './factions/index.ts';
export type { Prong, ProngOutcome, ProngPhase, ProngResult, ProngStatus, Raid, RaidOutcome, RaidPhase, RaidResult, RaidStatus } from './factions/index.ts';
export {
  econAlive,
  econAtByType,
  extCap,
  extractorMinCount,
  extractorShortfall,
  haulerNeed,
  haulerShortfall,
  haulerTarget,
  isHaulable,
  isStaffed,
  isMarkable,
  isMineable,
  isTypeUnlocked,
  isWorked,
  oreCost,
  resourceCost,
} from './field.ts';
export type { ResourceCost } from './field.ts';
export { recycleOrder } from './orders.ts';
export type { MovePart } from './orders.ts';
export { isCountedType } from './fleet.ts';
export { ECON_STRIKE_ORDER, guardPools, guardStrike } from './step.ts';
export type { StrikeKills } from './step.ts';
export { allocStatus, fieldSummary, movePreview, rockStatus } from './selectors.ts';
export type { AllocRow, AllocState, AllocStatus, BuildTypeCounts, FieldSummary, RockStatus } from './selectors.ts';
export type { RecycleCounts } from './inputs.ts';
export { isField } from './world.ts';
export type { EconShip, EconTypeCounts, FieldState, ProngStats, RaidStats } from './world.ts';
export type {
  AreaHeart,
  AreaSide,
  AreaLayout,
  Component,
  GuardMix,
  MapArea,
  MapLane,
  ResearchId,
  ResearchItem,
  ResearchKind,
  ResearchRequirement,
  ResourceTriple,
  GuardType,
  LayoutHeart,
  LayoutPocket,
  MapLayout,
  MapNode,
  NodeKind,
  Prize,
  RawResource,
  Resource,
  ShipType,
  SimData,
  SimTunableKey,
  TunableKey,
  TunableMeta,
  TunableSpec,
  Tunables,
} from './data.ts';
export {
  MIN_BUILD_TICKS,
  areaIndex,
  bandOpen,
  campaignWorld,
  commandedBands,
  designResearched,
  extractPct,
  haulIfReclaimedNow,
  isAreaOpen,
  isBandCommanded,
  isKnown,
  isLaneOpen,
  isReclaimed,
  maxCommandedBands,
  repeatOf,
  isWon,
  laneNeighbours,
  researchIndex,
  scaledCost,
  yardBuildTicks,
  yardTimePct,
} from './campaign.ts';
export type { CampaignStart, TierShortfall } from './campaign.ts';
export { areaFrontier, areaStatus, campaignStatus, campaignSummary, landingEffects, overworldStatus, researchEffect, researchStatus } from './overworld.ts';
export type {
  AreaFrontier,
  AreaGuardedNode,
  AreaState,
  AreaStatus,
  CampaignStatus,
  CampaignSummary,
  HeartTag,
  LandingEffects,
  LockReason,
  OverworldArea,
  OverworldStatus,
  ReclaimEntry,
  ResearchRow,
} from './overworld.ts';
export {
  PROBE,
  capEff,
  chooseVariant,
  countGuards,
  createWorld,
  guardCaps,
  guardianAt,
  heartIndex,
  isGuarded,
  nodeDistance,
  researchLevel,
  rootIndex,
} from './world.ts';
export type {
  ActiveBuild,
  AreaRecord,
  Campaign,
  ResearchPurchase,
  Assembler,
  Battle,
  BattleOutcome,
  BattleResult,
  BuildKind,
  BuildOrder,
  Capture,
  Guard,
  GuardCounts,
  Guardian,
  Node,
  Pod,
  Route,
  Ship,
  ShipTypeCounts,
  Stats,
  Stock,
  SystemInfo,
  Transit,
  Wilt,
  World,
  Yard,
} from './world.ts';
export { clampSendCounts, inputCost, isValidInput } from './inputs.ts';
export type { Input } from './inputs.ts';
export { GUARD_TARGET_ORDER, counterPct, step } from './step.ts';
export { fleetCap, fleetCount, fleetStatus, isFleetFull, recycleRefund } from './fleet.ts';
export type { FleetStatus, FleetTypeRow } from './fleet.ts';
export { replayHashes, worldHash } from './replay.ts';
export type { Replay } from './replay.ts';
export { deserializeWorld, serializeWorld } from './save.ts';
export type { LoadResult } from './save.ts';
export {
  TAG_STRONG_PCT,
  TAG_WEAK_PCT,
  activeBattles,
  assemblerStatus,
  battleStatus,
  combatRates,
  counterTag,
  guardianStatus,
  incomePerMin,
  isCaptured,
  isRootCut,
  lastBattle,
  nodeStatus,
  prizePerMin,
  queueStatus,
  routeCapacityPerMin,
  runSummary,
  shipCounts,
  shipsAtByType,
  shipsPerMinX10,
  supplyStatus,
  systemStatus,
  tagFor,
  throughputPerMin,
  unlockStatus,
  weightedMultPct,
  yardStatus,
} from './selectors.ts';
export type {
  AssemblerRow,
  AssemblerState,
  BattleStatus,
  CaptureEntry,
  CombatRates,
  CounterTag,
  GuardRow,
  GuardianStatus,
  HeartParams,
  NodeStatus,
  QueueStatus,
  RouteStatus,
  RunSummary,
  ShipCounts,
  SupplyStatus,
  SystemStatus,
  Tag,
  TargetSummary,
  UnlockStatus,
  YardRow,
  YardState,
  YardStatus,
} from './selectors.ts';
export { nextInt, nextU32 } from './rng.ts';
export { canonicalize, fnv1a, hashState } from './hash.ts';

/** data/sim.json, validated. */
export const defaultData: SimData = parseSimData(simData);

/** A sendShips `counts` that sends every ship at the source (each count is clamped to what is there). */
export const SEND_ALL: Readonly<ShipTypeCounts> = Object.freeze({ drone: 1_000_000, lancer: 1_000_000, flak: 1_000_000 });
