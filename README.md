# WC Fever 2026

Built this during the actual World Cup 2026 because I wanted something more
than a scoreboard — a dashboard that actually models what's happening.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-wc--fever--2026.vercel.app-brightgreen)](https://wc-fever-2026.vercel.app)

![Predict tab](screenshots/predict.png)

## What it does

The match predictor takes two teams and a stage, runs them through an XGBoost classifier trained on WC 2006–2022 results, and outputs win/draw/loss probabilities. Gets about 52% accuracy on the test split — way above the 33% random baseline. During a code review pass I caught a dead `_xg_model` reference that was silently falling back to a placeholder, fixed that to wire up the real StatsBomb pipeline.

The xG shot map pulls ~15k shots from StatsBomb open data (World Cup 2018 and earlier) and renders them on an SVG pitch coloured by expected goals value. You can filter by team and see a per-shot log alongside the pitch — distance, angle, pressure, and model xG for each attempt. Rebuilt this module after catching the dead model bug above.

The group stage tracker fetches live standings from football-data.org and runs 10,000 Monte Carlo simulations per group to estimate each team's advancement probability. I initially had a naive round-robin loop that generated schedules incorrectly — switched to a proper Berger tournament schedule algorithm and the simulated standings matched the real historical results much more closely.

## Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.10+, Flask |
| ML | XGBoost, scikit-learn, pandas, numpy |
| Frontend | React 18, Vite, Tailwind CSS |
| Charts | Plotly.js |
| Shot data | StatsBomb open data (~15k shots) |
| Live fixtures | football-data.org free tier |

## Run it locally

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add your football-data.org key (optional)
python app.py               # Flask on :5001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # Vite on http://localhost:5173
```

First call to `/api/predict` trains and caches the model (~5 sec). After that it loads from `models/outcome_predictor.pkl`.

## How the models work

**Match Predictor**
XGBoost classifier (`objective="multi:softprob"`, 200 trees, depth 4). Features: FIFA ranking diff, goals scored/conceded in last 5, head-to-head win rate, tournament stage, and host-nation flag. Trained on bundled WC 2006–2022 match results. Test accuracy 52% vs 33% random baseline.

**xG Model**
Logistic regression on StatsBomb shot data. Features: shot distance from goal, angle to goal centre, and whether the shooter was under pressure. Falls back to a simple analytic formula (`distance * angle / constant`) if the StatsBomb library isn't installed — same API surface either way.

**Monte Carlo group tracker**
Generates all round-robin fixtures using a Berger tournament schedule (not a naive nested loop — that was the original bug). Simulates each match using the outcome predictor's probabilities, runs 10,000 iterations, and caches advancement probabilities per group so repeated calls don't re-run the full simulation.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET | `/api/fixtures` | Upcoming WC 2026 fixtures (live, with fallback) |
| POST | `/api/predict` | `{ team_a, team_b, stage?, host? }` → win/draw/loss probs |
| GET | `/api/standings` | Live group standings |
| GET | `/api/xg/<team>` | Shot data for a team |
| GET | `/api/simulate/<group>` | Monte Carlo advancement % for a group |

## Data sources

**football-data.org** — free tier, no credit card. Sign up at [football-data.org/client/register](https://www.football-data.org/client/register) and paste the key in `backend/.env`. The app falls back to cached fixtures if the key is missing.

**StatsBomb open data** — completely free, no key needed. Installed via `pip install statsbombpy`. About 15k shots from WC 2018 and earlier tournaments used to train the xG model.

## What I'd improve

- **More WC data** — only 5 tournaments of training data. Euro/Copa América results would help a lot.
- **Real-time StatsBomb feed** — they have a live data product but it's commercial. For now the xG model is trained on historical shots only.
- **Player-level xG filtering** — the shot map aggregates by team. Per-player breakdowns would be a lot more interesting.
- **Mobile layout** — the pitch SVG and probability bars don't really work on small screens. Would need a different layout strategy entirely.

## Screenshots

![Predict](screenshots/predict.png)
![xG shot map](screenshots/xg.png)
![Group tracker](screenshots/groups.png)

---

Built by [Tanishk Tiwari](https://github.com/tanishk001-ai) · VIT Bhopal · WC 2026
