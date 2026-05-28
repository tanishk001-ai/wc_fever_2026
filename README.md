# World Cup 2026 Live Analytics Dashboard

A full-stack football analytics web app built around the **FIFA World Cup 2026** (USA · Canada · Mexico). Three modules: a match outcome predictor (XGBoost), an Expected Goals heatmap (StatsBomb open data), and a live group stage tracker with Monte Carlo advancement probabilities.

> **Status:** Module 1 (Match Predictor) is live. Modules 2 (xG Heatmap) and 3 (Group Tracker) are stubbed in the UI and will land next.

![Stack](https://img.shields.io/badge/Backend-Flask-000?logo=flask) ![ML](https://img.shields.io/badge/ML-XGBoost-EB6E4B) ![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react) ![Styling](https://img.shields.io/badge/Styling-Tailwind-38BDF8?logo=tailwindcss)

---

## Why this project

The 2026 World Cup is the first 48-team World Cup and the first hosted across three nations. I wanted a live dashboard that wasn't just a scoreboard — something that actually models the tournament: outcome probabilities, shot quality, and group dynamics. It's also a chance to ship a clean end-to-end ML product (data → model → API → UI) rather than a notebook.

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Python 3.10+, Flask, Flask-CORS |
| ML | XGBoost, scikit-learn, pandas, numpy |
| Data | football-data.org (live) · StatsBomb open data (historical shots) |
| Frontend | React 18, Vite, Tailwind CSS |
| Charts | Plotly.js |

---

## Project structure

```
world-cup-2026-dashboard/
├── backend/
│   ├── app.py                       # Flask API
│   ├── models/
│   │   ├── outcome_predictor.py     # Module 1 (XGBoost)
│   │   ├── xg_model.py              # Module 2 (stub)
│   │   └── monte_carlo.py           # Module 3 (stub)
│   ├── data/
│   │   ├── fetch_data.py            # API client + bundled historical CSV
│   │   └── historical_matches.csv   # generated on first run
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── MatchPredictor.jsx
    │   │   ├── XGHeatmap.jsx
    │   │   └── GroupTracker.jsx
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Module 1 — Match Outcome Predictor

**Goal:** given two teams and a tournament stage, output `P(A_WIN)`, `P(DRAW)`, `P(B_WIN)`.

**Features used**
- FIFA ranking difference (`rank_a - rank_b`)
- Team's goals scored / conceded in last 5 matches
- Head-to-head win rate (over all prior meetings)
- Tournament stage (group / R16 / QF / SF / final)
- Host-nation flag for each team

**Model:** XGBoost classifier with `objective="multi:softprob"`, 200 trees, depth 4. Trained on real WC 2006–2022 results bundled in `data/fetch_data.py`. Test accuracy ≈ 52% (random baseline ≈ 33%).

The trained model is persisted as `models/outcome_predictor.pkl` so subsequent runs skip training.

---

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then paste your football-data.org key
python data/fetch_data.py     # writes historical_matches.csv
python app.py                 # starts Flask on :5000
```

First request to `/api/predict` will train the model (~5 seconds) and cache it as `models/outcome_predictor.pkl`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # Vite on http://localhost:5173
```

Vite proxies `/api/*` to Flask, so you don't need to think about CORS in dev.

---

## API keys

Sign up for a free football-data.org key at **https://www.football-data.org/client/register**. Paste it into `backend/.env`:

```
FOOTBALL_DATA_API_KEY=your_key_here
```

If you skip this step, the API falls back to cached/sample fixtures so the demo still works.

StatsBomb data requires no key — it's installed via `pip install statsbombpy`.

---

## API endpoints

| Method | Path | Notes |
|---|---|---|
| GET  | `/api/health`    | Liveness check |
| GET  | `/api/fixtures`  | Upcoming WC 2026 fixtures (live, with fallback) |
| POST | `/api/predict`   | Body: `{ team_a, team_b, stage?, host? }` |
| GET  | `/api/standings` | Live group standings (used by Module 3) |

Example:
```bash
curl -X POST http://localhost:5000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"team_a":"Argentina","team_b":"Brazil","stage":"SF"}'
```

---

## Screenshots

_To be added after Modules 2 and 3 land:_
- `screenshots/predict.png` — Match Predictor tab
- `screenshots/xg.png` — xG Heatmap tab
- `screenshots/tracker.png` — Group Tracker tab

---

## Roadmap

- [x] **Module 1** — Match Outcome Predictor (XGBoost, /api/predict, React UI)
- [ ] **Module 2** — xG Heatmap (StatsBomb shots, SVG pitch, per-team filter)
- [ ] **Module 3** — Group Stage Tracker (live standings, Monte Carlo advancement %)
- [ ] Deploy backend to Render / frontend to Vercel

---

Built during WC 2026 for portfolio purposes.
