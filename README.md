# WinterArc

A personal PWA training guide: 25 weeks from Mon, Oct 26, 2026 to the Vancouver Sun Run 10K on Sun, Apr 18, 2027. The goals are a 10K under 60 minutes by the end of January, about 55 minutes at the Sun Run, and a body weight of 165 lb by race day, from a start near 238.

Live: https://marcs12.github.io/461da5a09/

## The plan

Weeks run Monday to Sunday.

| Day | Session |
|---|---|
| Mon | Strength A (kettlebell) |
| Tue | Run |
| Wed | Low-impact cardio, an easy run from week 6 |
| Thu | Run, a workout from week 7 |
| Fri | Strength B (dumbbell) |
| Sat | Rest |
| Sun | Long run or time trial |

| Phase | Weeks | Running |
|---|---|---|
| Rebuild | 1–3 | Run/walk intervals up to 30 minutes non-stop |
| Base | 4–8 | Easy running, a fourth run from week 6, first workouts, a 5K time trial on Dec 20 (under 31:00) |
| Speed | 9–13 | 1 km and 2–3 km repeats, tempos, long run to 11 km, a 5K time trial on Jan 17 (under 28:45) |
| Sub-60 | 14 | Lighter week, then a 10K time trial on Jan 31 (under 60:00); Feb 28 is the fallback |
| Push | 15–23 | Faster repeats and tempos toward 5:30/km, long run to 14 km, a 5K time trial on Mar 14 (under 26:30) |
| Taper | 24 | Less volume, a few efforts at goal pace |
| Race week | 25 | Two short runs, then the 10K, goal 55:00 |

Calories, protein and steps step down by week, and each step ends on a weight checkpoint:

| Weeks | Calories | Protein | Steps | On track | Fallback |
|---|---|---|---|---|---|
| 1–8 | 1,600 | 190 g | 12,000 | 210 lb | 214 lb |
| 9–14 | 1,600 | 190 g | 12,000 | 193 lb | 199 lb |
| 15–20 | 1,500 | 180 g | 15,000 | 177 lb | 184 lb |
| 21–24 | 1,500 | 180 g | 15,000 | 165 lb | 172 lb |
| 25 | 2,400 | 150 g | 10,000 | | |

Dec 24 and 25, and Jan 28 to 30 before the time trial, are at maintenance. 1,500 kcal is the floor while training.

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
