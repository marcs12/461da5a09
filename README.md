# Quarter

A personal PWA for a 90-day reset across Income, Body, Mind and Money: a quarter, with four areas making the whole. The logo is that ring, with the current quarter in red.

Its training log follows a 16-week program (Sep 28, 2026 – Jan 17, 2027): a 3-week cut, a break week, a 4-week base block, and an 8-week build to a 10K on Sun, Jan 17. Weekly layout follows Huberman's protocol; weeks run Monday to Sunday, with the long run on Sunday. Weight loss is the priority, so the calorie deficit runs through every phase except the break.

The cardio is written for someone who already runs 2.5 km at 7:30/km: continuous running from week 1, no walk-run ramp.

Huberman's Day 6 (brief, high-intensity cardio) is a dumbbell complex adapted from a kettlebell one: 10 reps each of bent-over row, goblet squat, push-up, goblet curl, swing and thruster make a round, done as many rounds as possible in 10–17 minutes with one adjustable 0–50 lb dumbbell. From week 9 it alternates with running intervals.

Live: https://marcs12.github.io/461da5a09/

## What it does

The app is a life guide for a 90-day reset (Sep 28 – Dec 26, 2026) across **Income, Body, Mind and Money**. The plan's content lives in `src/data/plan-seed.json`, so it can change without code changes.

- **Today** — day X of 90, the phase and the countdown; the minimum day (five items, three in travel mode) with a never-miss-twice streak; the next gate; the day's time blocks with training at 5:15 or pushed to the evening; this week's top 3; quick logs for weight, workout, walk, applications and check-ins; payday, Sunday-review, waist and support banners when they apply.
- **Income** — the job pipeline with 7-day follow-ups, weekly targets by phase, tier mix, outreach, the career checklist, the credential, the freelance test and a brag file. A Vancouver ↔ Vietnam time converter in travel mode.
- **Body** — an overview (the week's training, food checks, weekly weight average, waist, the travel circuit, the Sun Run, the checkup) in front of the original training log:
  - **Session** — the day's session with week-specific prescription, an interval timer (color flips per segment, beeps, vibrates, keeps the screen awake, counts complex rounds), set logging with "add 5 lb" progression hints, weigh-in, calories, protein and sleep.
  - **Program** — all 16 weeks at a glance, colored by session type, with done and missed days.
  - **Progress** — weight chart with a 7-day average and the Phase 1 target corridor, week-by-week table, lift progression, daily targets.
- **Mind** — the evening check-in, mood and sleep trends, the support trigger with resources (9-8-8 always visible), daily base, connection and fun, the critic tool and the four anchors.
- **Money** — the trip budget, the money snapshot, the Freedom Fund and runway, payday transfers, the order of operations and the spending rules. General budgeting guidance, not investment advice.
- **Plan** — the Day-90 scoreboard measured from the logs, the gates, the roadmap, the five rules and the weekly time budget.
- **Review** — the Sunday review: the week scored from the logs, keep and change, next week's top 3, support and money checks, a backup nudge; history and copy-as-text.
- **Settings** — plan dates, sleep, training, work and pay, sync and backup, and "start the next 90 days".
- Installable PWA that works offline.

## Sync between devices

Data is stored in the browser. To share it between devices, open **Settings → Sync and backup** and paste a GitHub token with only the `gist` scope. The first device creates a secret gist; others find it with their own token. Days merge last-writer-wins, so edits on either device survive.

The token is kept in that browser's localStorage and only sent to `api.github.com`. Check-ins, mood, reviews and money never sync; they stay on the device (`twentyone-weeks-private`). Export/Import JSON is the manual backup and includes everything, private data too.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173/461da5a09/
npm run build
npm test         # unit tests, run in Vancouver time
```

Pushes to `main` deploy through `.github/workflows/deploy.yml`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

`artifact/index.html` is the original single-file version, kept for reference.
