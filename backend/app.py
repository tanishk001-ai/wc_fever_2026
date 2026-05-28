"""
Flask API for the World Cup 2026 Dashboard.

Endpoints:
  GET  /api/health
  GET  /api/fixtures               -> upcoming WC 2026 fixtures
  POST /api/predict                -> match outcome probabilities
  GET  /api/standings              -> live group standings
  GET  /api/xg/teams               -> list of teams with shot data  [Module 2]
  GET  /api/xg/shots?team=France   -> shot map + xG for a team      [Module 2]
"""

from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

from data.fetch_data import fetch_upcoming_fixtures, fetch_group_standings
from models.outcome_predictor import predict_match, load_or_train
from models.xg_model import load_xg_model, get_team_shots, get_available_teams
from models.monte_carlo import simulate_group  # Module 3

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

app = Flask(__name__)
CORS(app)  # allow the React dev server to call us

# Warm the match-outcome model at boot so the first /api/predict isn't slow.
# Wrapped in try/except so a missing package or training hiccup doesn't kill Flask —
# predict_match() calls load_or_train() lazily too, so it self-heals on first request.
try:
    load_or_train()
except Exception as _e:
    import warnings
    warnings.warn(f"[app] Model warm-up skipped: {_e}. Will retrain on first /api/predict request.")

# Load the xG model (returns None if train script hasn't been run yet;
# the endpoints fall back to the analytic estimate in that case).
try:
    _xg_model = load_xg_model()
except Exception:
    _xg_model = None


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "module": "world-cup-2026-dashboard"})


@app.get("/api/fixtures")
def fixtures():
    """Upcoming WC 2026 fixtures (live API with fallback)."""
    try:
        return jsonify({"fixtures": fetch_upcoming_fixtures()})
    except Exception as exc:
        app.logger.exception("fixtures failed")
        return jsonify({"error": str(exc)}), 500


@app.post("/api/predict")
def predict():
    """
    Body: { "team_a": str, "team_b": str, "stage": str?, "host": str? }
    """
    body = request.get_json(force=True, silent=True) or {}
    team_a = body.get("team_a")
    team_b = body.get("team_b")
    if not team_a or not team_b:
        return jsonify({"error": "team_a and team_b are required"}), 400

    stage = body.get("stage", "GROUP")
    host = body.get("host", "USA")  # WC 2026 primary host
    try:
        result = predict_match(team_a, team_b, stage=stage, host=host)
        return jsonify(result)
    except Exception as exc:
        app.logger.exception("predict failed")
        return jsonify({"error": str(exc)}), 500


@app.get("/api/standings")
def standings():
    """
    Live group standings + Monte Carlo advancement probabilities.

    Response shape:
    {
      "groups": [
        {
          "group": "Group A",
          "teams": [
            {
              "name": "Mexico", "played": 1, "won": 1, "draw": 0, "lost": 0,
              "points": 3, "goal_diff": 1, "advancement_prob": 0.84
            },
            ...
          ]
        },
        ...
      ],
      "generated_at": "2026-06-14T15:30:00Z"
    }
    """
    import datetime

    try:
        raw_groups = fetch_group_standings()

        enriched = []
        for group in raw_groups:
            teams = [t["name"] for t in group["teams"]]
            sim_result = simulate_group(
                group_name=group["group"],
                teams=teams,
                current_standings=group["teams"],
            )
            enriched.append(sim_result)

        return jsonify({
            "groups": enriched,
            "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        })

    except Exception as exc:
        app.logger.exception("standings failed")
        return jsonify({"error": str(exc)}), 500


# ── Module 2: xG Heatmap endpoints ───────────────────────────────────────────

@app.get("/api/xg/teams")
def xg_teams():
    """
    Return the sorted list of teams that have shot data available.
    The frontend uses this to populate the team selector dropdown.
    """
    try:
        return jsonify({"teams": get_available_teams()})
    except Exception as exc:
        app.logger.exception("xg/teams failed")
        return jsonify({"error": str(exc)}), 500


@app.get("/api/xg/shots")
def xg_shots():
    """
    Return shot data + xG values for a single team.

    Query param: ?team=Argentina  (required)

    Response shape:
    {
      "team": "Argentina",
      "shots": [
        { "id": 0, "x": 105.2, "y": 38.4, "xg": 0.23,
          "outcome": "Goal", "player": "Lionel Messi",
          "minute": 14, "is_header": 0, "technique": "Normal" },
        ...
      ],
      "summary": {
        "total_shots": 45, "total_xg": 8.3,
        "goals": 5, "shots_on_target": 18
      },
      "source": "statsbomb" | "synthetic"
    }
    """
    team = request.args.get("team", "").strip()
    if not team:
        return jsonify({"error": "team query parameter is required"}), 400

    try:
        data = get_team_shots(team, _xg_model)
        return jsonify({"team": team, **data})
    except Exception as exc:
        app.logger.exception("xg/shots failed")
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
