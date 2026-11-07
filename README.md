# WinterArc

A personal PWA training guide: 25 weeks from Mon, Oct 26, 2026 to the Vancouver Sun Run 10K on Sun, Apr 18, 2027. The goals are a 10K under 60 minutes by the end of January, about 55 minutes at the Sun Run, and a body weight of 165 lb by race day, from a start near 238, then as lean as possible for Hawaii at the end of April.

Live: https://marcs12.github.io/461da5a09/

## The plan

Weeks run Monday to Sunday.

| Day | Session |
|---|---|
| Mon | Strength A (kettlebell), ending with core |
| Tue | Run |
| Wed | Low-impact cardio, an easy run from week 6 |
| Thu | Run, a workout from week 7 |
| Fri | Strength B (dumbbell), ending with core |
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

## What it does

- **Today**: your arc first (where you started, where you are and Apr 18, with the session streak, a forecast and the next time trial), then the day's session with why it matters with its prescription, an interval timer for every timed run (color flips per segment, beeps, vibrates, keeps the screen awake), set logging with "add 5 lb" hints, the morning weigh-in against the plan, and calories, protein, steps and sleep against the day's targets.
- **Program**: all 25 weeks at a glance, colored by session type, with done and missed days and each week's calories.
- **Progress**: one gauge for how far along the whole plan is (body, speed and habits), the next milestone, and a card per goal: Body (pounds down, checkpoints, the weight chart), Speed (the 10K you could run now, predicted from your watch laps with Riegel's formula), Engine (resting heart rate, HRV and distance per heartbeat on easy runs), Habits (sessions, step streak, weekly km), Strength (top sets against the bells' maximum), the time trials and a wall of milestones. The week-by-week table and the day's targets sit underneath.
- **Food**: the repeat day (bulgogi beef, pork adobo, rotisserie chicken), swaps, recipes, the two-week Costco checklist and Saturday prep.
- **Guide**: the food and running rules, the checkpoints, when to ease off, and what to do after the race.
- **Settings**: starting weight, calorie and protein overrides, sync and backup.
- Installable PWA that works offline.

## Garmin

A scheduled GitHub Action (`.github/workflows/garmin-sync.yml`, every 30 minutes, or by hand from the Actions tab) runs `scripts/garmin-sync.mjs`. It uses the Garmin Connect Personal API to pull activities (with laps from the FIT file for runs), steps, sleep, overnight HRV, resting heart rate, weigh-ins and heart rate zones, and merges them into the sync gist as `garminActs`, `garminDays` and `garminSync`. Devices pick them up on their next sync.

It needs two repository secrets: `GARMIN_API_KEY` (from Garmin Connect, Personal API Key) and `GIST_TOKEN` (a GitHub token with only the gist scope). The repo is public, so the job's log shows counts and response shapes, never values. `DRY_RUN=1` fetches without writing.

In the app:
- A run, strength session or walk from the watch ticks the day off when it covers the session. Unticking by hand overrides it.
- Steps, sleep and Garmin-scale weigh-ins fill in where nothing was typed.
- Time trials and the race are timed from the activity, or from the fastest stretch of 1 km laps when the warm-up was recorded too. Interval days count the repeats run at the target pace.
- Easy runs in heart rate zone 3 or above get flagged.
- Recovery compares the last 7 days of HRV, resting heart rate and sleep, plus heartbeats per km on easy runs, with the 4 weeks before. Two warning signs together say ease off, the plan's own rule.

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
