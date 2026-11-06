# Reviews

One file per task, `reviews/<task-id>.md`, written by the Critic on the task branch. Each review round appends a section; `npm run merge-task` reads the last verdict line.

```
## Round <n> · <date>

Pillar fit: ...
Quality: ...
Gates: <link or summary of reports/gates-latest.json>
Required changes:
- ...

VERDICT: APPROVE | REJECT
```
