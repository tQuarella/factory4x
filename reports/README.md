# Reports

Gate and bot output. `*-latest.*` files are regenerated on every run and not committed. Copy a report into `reports/archive/` when it backs a decision or a handoff.

- `gates-latest.json` — pass/fail and duration per gate
- `bots-latest.{json,md}` — per-strategy win rate, time to win, tick p95, outcomes
- `determinism-latest.json` — reference replay hashes every 300 ticks
