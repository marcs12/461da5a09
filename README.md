# Twenty-One Weeks

Training log for a 21-week program (Sep 19, 2026 – Feb 12, 2027): a 4-week cut, a break week, a 4-week walk-run block, and a 12-week build to 10K. Weekly layout follows Huberman's protocol with Day 1 on Saturday.

Live: https://marcs12.github.io/461da5a09/

## What it does

- **Today** — the day's session with week-specific prescription, an interval timer (color flips per segment, beeps, vibrates, keeps the screen awake), set logging with "add 5 lb" progression hints, weigh-in, calories, protein and sleep.
- **Plan** — all 21 weeks at a glance, colored by session type, with done and missed days.
- **Progress** — weight chart with a 7-day average and the Phase 1 target corridor, week-by-week table, lift progression, daily targets.
- Installable PWA that works offline.

## Sync between devices

Data is stored in the browser. To share it between devices, open **Sync** (top-right) and paste a GitHub token with only the `gist` scope. The first device creates a secret gist; others find it with their own token. Days merge last-writer-wins, so edits on either device survive.

The token is kept in that browser's localStorage and only sent to `api.github.com`. Export/Import JSON is there as a manual backup.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173/461da5a09/
npm run build
```

Pushes to `main` deploy through `.github/workflows/deploy.yml`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

`artifact/index.html` is the original single-file version, kept for reference.
