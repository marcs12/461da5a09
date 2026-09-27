# Quarter

A personal PWA for a 90-day reset across Income, Body, Mind and Money: a quarter, with four areas making the whole. The logo is that ring, with the current quarter in red.

Its training log follows a 16-week program (Sep 27, 2026 – Jan 16, 2027): a 3-week cut, a break week, a 4-week base block, and an 8-week build to a 10K on Sun, Jan 10. Weekly layout follows Huberman's protocol, with Day 1 on Sunday. Weight loss is the priority, so the calorie deficit runs through every phase except the break.

The cardio is written for someone who already runs 2.5 km at 7:30/km: continuous running from week 1, no walk-run ramp.

Huberman's Day 6 (brief, high-intensity cardio) is a dumbbell complex adapted from a kettlebell one: 10 reps each of bent-over row, goblet squat, push-up, goblet curl, swing and thruster make a round, done as many rounds as possible in 10–17 minutes with one adjustable 0–50 lb dumbbell. From week 9 it alternates with running intervals.

Live: https://marcs12.github.io/461da5a09/

## What it does

The app is a life guide for a 90-day reset (Sep 28 – Dec 26, 2026) across **Income, Body, Mind and Money**. It opens on **Today**; **Plan**, **Review** and **Settings** sit in the header. The plan's content lives in `src/data/plan-seed.json`, so it can change without code changes.

The original training log lives under **Body**:

- **Session** — the day's session with week-specific prescription, an interval timer (color flips per segment, beeps, vibrates, keeps the screen awake, counts complex rounds), set logging with "add 5 lb" progression hints, weigh-in, calories, protein and sleep.
- **Program** — all 16 weeks at a glance, colored by session type, with done and missed days.
- **Progress** — weight chart with a 7-day average and the Phase 1 target corridor, week-by-week table, lift progression, daily targets.
- Installable PWA that works offline.

## Sync between devices

Data is stored in the browser. To share it between devices, open **Settings → Sync and backup** and paste a GitHub token with only the `gist` scope. The first device creates a secret gist; others find it with their own token. Days merge last-writer-wins, so edits on either device survive.

The token is kept in that browser's localStorage and only sent to `api.github.com`. Check-ins, mood and money never sync; they stay on the device. Export/Import JSON is the manual backup and includes everything, private data too.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173/461da5a09/
npm run build
npm test         # unit tests, run in Vancouver time
```

Pushes to `main` deploy through `.github/workflows/deploy.yml`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

`artifact/index.html` is the original single-file version, kept for reference.
