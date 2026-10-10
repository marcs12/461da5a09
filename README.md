# WinterArc

A personal PWA training guide: 25 weeks from Mon, Oct 26, 2026 to the Vancouver Sun Run 10K on Sun, Apr 18, 2027. The goal is a 10K under 60 minutes (5:59/km) and a body weight around 170 lb, from a start near 238.

Live: https://marcs12.github.io/461da5a09/

## The plan

Weeks run Monday to Sunday.

| Day | Session |
|---|---|
| Mon | Strength A (kettlebell) |
| Tue | Run |
| Wed | Low-impact cardio, 30 min |
| Thu | Run, a workout from week 17 |
| Fri | Strength B (dumbbell) |
| Sat | Rest |
| Sun | Long run |

| Phase | Weeks | Running |
|---|---|---|
| Rebuild | 1–6 | Run/walk intervals up to 30 minutes non-stop |
| Base | 7–16 | All easy running, long run from 5 km to 9 km, a 5K time trial in week 12 |
| Speed | 17–23 | One workout a week (1 km repeats or a tempo), long run to 12 km, a 5K time trial in week 20 |
| Taper | 24 | Less volume, a few efforts at race pace |
| Race week | 25 | Two short runs, then the 10K |

Calories and protein step down by week, and each step ends on a weight checkpoint:

| Weeks | Calories | Protein | On track | Floor |
|---|---|---|---|---|
| 1–8 | 1,700 | 180 g | 213 lb | 217 lb |
| 9–16 | 1,600 | 180 g | 194 lb | 200 lb |
| 17–24 | 1,500 | 170 g | 174 lb | 182 lb |
| 25 | 2,300 | 150 g | | |

Dec 24 and 25 are at maintenance. 1,500 kcal is the floor while training. 10,000 steps a day run through the whole plan.

## What it does

- **Today**: the day's session with its prescription, an interval timer for every timed run (color flips per segment, beeps, vibrates, keeps the screen awake), set logging with "add 5 lb" hints, the morning weigh-in against the plan, and calories, protein, steps and sleep against the day's targets.
- **Program**: all 25 weeks at a glance, colored by session type, with done and missed days and each week's calories.
- **Progress**: the weight chart with a 7-day average over the target band (on track to floor), a week-by-week table against the plan, lift progression and the day's targets.
- **Guide**: the repeat-meal day and how it changes by tier, the food and running rules, the checkpoints, when to ease off, and what to do after the race.
- **Settings**: starting weight, calorie and protein overrides, sync and backup.
- Installable PWA that works offline.

## Where the plan lives

- `src/lib/program.ts`: the calendar, phases, every run and both strength sessions.
- `src/lib/targets.ts`: calorie tiers, weight checkpoints and the target line.
- `src/views/Guide.tsx`: the meals and the written rules.

## Data

Data is stored in the browser under the same keys as the earlier versions of this app (the 16-week training log, then Quarter), so everything logged before still loads: older weigh-ins lead into the chart and older lifts show under Progress. Entries from Quarter's Income, Mind and Money tabs are no longer shown, but they are kept in storage and in exports.

To share the log between devices, open **Settings → Sync and backup** and paste a GitHub token with only the `gist` scope. The first device creates a secret gist; others find it with their own token. Days merge last-writer-wins, so edits on either device survive. The token is kept in that browser's localStorage and only sent to `api.github.com`. The private collections from Quarter (check-ins, mood, money) never sync. Export/Import JSON is the manual backup and includes everything.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173/461da5a09/
npm run build
npm test         # unit tests, run in Vancouver time
```

Pushes to `main` deploy through `.github/workflows/deploy.yml`.

`artifact/index.html` is the original single-file version, kept for reference.
