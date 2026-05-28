"""
One-time setup script: download StatsBomb WC 2018 + Euro 2020 open data,
extract shot events, train the XGBoost xG model, and save pre-processed
shot data for the /api/xg/shots endpoint.

Run once from the backend/ directory:
    python scripts/train_xg_model.py

Requirements:  statsbombpy (already in requirements.txt)
Internet:      yes — fetches data from StatsBomb's open-data GitHub repo

Produces:
    models/xg_model.pkl    – trained XGBClassifier
    data/wc_shots.json     – {team: {shots:[...], summary:{...}}} for WC 2018

After this script completes you will see richer, real data in the xG Map tab.
The API already works without running this script (synthetic fallback is used).
"""

import sys
import json
from pathlib import Path

# Make backend package importable when run as a script from any directory
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pandas as pd

# statsbombpy wraps the StatsBomb open-data GitHub repo
from statsbombpy import sb

from models.xg_model import (
    DATA_DIR,
    SHOTS_JSON,
    FEATURE_COLS,
    TECHNIQUE_RANK,
    _distance,
    _angle,
    _analytic_xg,
    train_xg_model,
)


# ── Competitions to download ───────────────────────────────────────────────────
# We train on both to get a larger, more diverse shot pool.
# Only WC 2018 shots are saved to wc_shots.json (the heatmap data).
COMPETITIONS = [
    (43, 3,  "FIFA World Cup 2018",  True),   # (comp_id, season_id, label, save_for_api)
    (55, 43, "UEFA Euro 2020",       False),
]


def _extract_name(val) -> str:
    """
    Pull a plain string name out of a StatsBomb value that may be:
      - a dict  like {"id": 10, "name": "Goal"}
      - already a plain string like "Goal"
      - NaN / None / missing

    Handles both the nested-dict layout (statsbombpy < 0.9) and the
    newer flat layout where sub-fields are already plain strings.
    """
    if val is None:
        return ""
    try:
        import math
        if math.isnan(float(val)):
            return ""
    except (TypeError, ValueError):
        pass
    if isinstance(val, dict):
        return str(val.get("name", "")).strip()
    return str(val).strip()


def _parse_shot_row(row) -> dict | None:
    """
    Extract features + metadata from a single row of the statsbombpy events DataFrame.

    Handles two statsbombpy layouts:
      - Nested: row["shot"] is a dict with keys "outcome", "body_part", "technique", "type"
        (common in statsbombpy <= 0.8)
      - Flat: row["shot_outcome"], row["shot_body_part"], etc. are separate string/dict
        columns (statsbombpy >= 0.9 expands nested dicts into separate columns)

    Returns None if the row can't be parsed.
    """
    try:
        loc = row.get("location", None)
        if loc is None or not hasattr(loc, "__len__") or len(loc) < 2:
            return None

        x, y = float(loc[0]), float(loc[1])

        # ── Determine layout and extract sub-fields ──────────────────────────
        # statsbombpy has two layouts depending on version:
        #   Nested  (< 1.0): row["shot"] is a dict with keys "outcome", "body_part", etc.
        #   Flat dict (0.9): row["shot_outcome"] is a dict like {"id": 96, "name": "Goal"}
        #   Flat string (1.0+): row["shot_outcome_name"] is already a plain string "Goal"
        # We try all three so the script works across every statsbombpy release.
        shot_detail = row.get("shot", None)
        if isinstance(shot_detail, dict) and shot_detail:
            # Nested layout
            outcome_name = _extract_name(shot_detail.get("outcome"))
            body_part    = _extract_name(shot_detail.get("body_part"))
            technique    = _extract_name(shot_detail.get("technique")) or "Normal"
            shot_type    = _extract_name(shot_detail.get("type"))      or "Open Play"
        else:
            # Flat layout — try _name-suffixed columns first (statsbombpy >= 1.0),
            # then fall back to the dict-valued columns (statsbombpy 0.9.x).
            outcome_name = (
                _extract_name(row.get("shot_outcome_name"))
                or _extract_name(row.get("shot_outcome"))
            )
            body_part = (
                _extract_name(row.get("shot_body_part_name"))
                or _extract_name(row.get("shot_body_part"))
            )
            technique = (
                _extract_name(row.get("shot_technique_name"))
                or _extract_name(row.get("shot_technique"))
                or "Normal"
            )
            shot_type = (
                _extract_name(row.get("shot_type_name"))
                or _extract_name(row.get("shot_type"))
                or "Open Play"
            )

        # StatsBomb outcome name for goals is exactly "Goal"
        is_goal        = int(outcome_name == "Goal")
        is_header      = int(body_part == "Head")
        is_penalty     = int(shot_type  == "Penalty")
        under_pressure = int(bool(row.get("under_pressure", False)))
        technique_rank = TECHNIQUE_RANK.get(technique, 0)

        # Player and team may be dicts or strings depending on statsbombpy version
        player_raw  = row.get("player", "Unknown")
        player_name = _extract_name(player_raw) if isinstance(player_raw, dict) else str(player_raw)
        team_raw    = row.get("team", "Unknown")
        team_name   = _extract_name(team_raw) if isinstance(team_raw, dict) else str(team_raw)

        return {
            # Training features
            "distance":       _distance(x, y),
            "angle":          _angle(x, y),
            "is_header":      is_header,
            "is_penalty":     is_penalty,
            "under_pressure": under_pressure,
            "technique":      technique_rank,
            "is_goal":        is_goal,
            # API metadata (only used for wc_shots.json)
            "_x":             round(x, 1),
            "_y":             round(y, 1),
            "_outcome":       outcome_name,
            "_player":        player_name,
            "_minute":        int(row.get("minute", 0)),
            "_is_header":     is_header,
            "_technique":     technique,
            "_team":          team_name,
        }
    except Exception:
        return None   # silently skip malformed rows


def download_shots() -> tuple[pd.DataFrame, dict]:
    """
    Download shot events for all configured competitions.

    Returns:
        shots_df   – DataFrame ready for model training (all competitions)
        team_shots – dict  {team: [shot_api_dict, ...]}  (WC 2018 only)
    """
    all_rows  = []
    team_shots: dict[str, list] = {}
    shot_id   = 0   # globally unique id for the frontend key prop

    for comp_id, season_id, label, save_api in COMPETITIONS:
        print(f"\n[train] Fetching match list — {label}...")
        try:
            matches = sb.matches(competition_id=comp_id, season_id=season_id)
        except Exception as exc:
            print(f"[train]   SKIP: {exc}")
            continue

        print(f"[train]   {len(matches)} matches found.")

        for _, match_row in matches.iterrows():
            match_id = int(match_row["match_id"])
            try:
                events = sb.events(match_id=match_id)
            except Exception as exc:
                print(f"[train]   Match {match_id} events failed: {exc}")
                continue

            shot_events = events[events["type"] == "Shot"]

            for _, ev_row in shot_events.iterrows():
                parsed = _parse_shot_row(ev_row)
                if parsed is None:
                    continue

                # Add to training pool
                all_rows.append({col: parsed[col] for col in FEATURE_COLS + ["is_goal"]})

                # Add to API data (WC 2018 only)
                if save_api:
                    team = parsed["_team"]
                    if team not in team_shots:
                        team_shots[team] = []
                    team_shots[team].append({
                        "id":        shot_id,
                        "x":         parsed["_x"],
                        "y":         parsed["_y"],
                        "outcome":   parsed["_outcome"],
                        "player":    parsed["_player"],
                        "minute":    parsed["_minute"],
                        "is_header": parsed["_is_header"],
                        "technique": parsed["_technique"],
                        # xG gets filled in after training
                        "xg":        0.0,
                    })
                    shot_id += 1

        print(f"[train]   Running total shots: {len(all_rows)}")

    shots_df = pd.DataFrame(all_rows)
    print(f"\n[train] Total training shots: {len(shots_df)}")
    print(f"[train] WC 2018 teams collected: {len(team_shots)}")
    return shots_df, team_shots


def fill_xg(model, team_shots: dict) -> dict:
    """
    Use the trained model to compute and store xG for every API shot.
    Also computes summary stats per team.
    """
    result = {}

    for team, shots in team_shots.items():
        if not shots:
            continue

        # Build feature matrix for the whole team in one go (faster than one-by-one)
        rows = []
        for s in shots:
            rows.append({
                "distance":       _distance(s["x"], s["y"]),
                "angle":          _angle(s["x"], s["y"]),
                "is_header":      s["is_header"],
                "is_penalty":     int(s["technique"] == "Penalty"),
                "under_pressure": 0,   # not stored in API rows
                "technique":      TECHNIQUE_RANK.get(s["technique"], 0),
            })

        features_df = pd.DataFrame(rows)[FEATURE_COLS]
        try:
            xg_values = model.predict_proba(features_df)[:, 1].tolist()
        except Exception:
            # Fallback to analytic if model misbehaves
            xg_values = [_analytic_xg(s["x"], s["y"], s["is_header"]) for s in shots]

        enriched = []
        for s, xg_val in zip(shots, xg_values):
            enriched.append({**s, "xg": round(float(xg_val), 3)})

        goals      = sum(1 for s in enriched if s["outcome"] == "Goal")
        on_target  = sum(1 for s in enriched if s["outcome"] in ("Goal", "Saved"))
        total_xg   = round(sum(s["xg"] for s in enriched), 2)

        result[team] = {
            "shots": enriched,
            "summary": {
                "total_shots":     len(enriched),
                "total_xg":        total_xg,
                "goals":           goals,
                "shots_on_target": on_target,
            },
            "source": "statsbomb",   # UI shows real-data badge
        }

    return result


def main():
    print("=" * 60)
    print("World Cup Fever — xG Model Training Script")
    print("=" * 60)
    print("Downloads StatsBomb open data and trains XGBoost xG model.")
    print()

    # 1. Download data
    shots_df, team_shots = download_shots()

    if shots_df.empty:
        print("\n[train] No shots downloaded. Check your internet connection.")
        sys.exit(1)

    # 2. Report class balance — fail fast if parsing is broken
    goal_rate = shots_df["is_goal"].mean()
    print(f"\n[train] Goal rate in training set: {goal_rate:.1%}  (expected ~10–11%)")

    if goal_rate < 0.01:
        print("\n[train] ERROR: Goal rate is near zero — outcome parsing failed.")
        print("[train] This usually means statsbombpy is using a flat column layout.")
        print("[train] The updated _parse_shot_row should handle this. Check the statsbombpy version:")
        print("[train]   pip show statsbombpy")
        print("[train] Falling back to analytic xG for wc_shots.json anyway...")
        # Use analytic formula instead of training a useless model
        from models.xg_model import _analytic_xg
        for team, shots in team_shots.items():
            for s in shots:
                s["xg"] = _analytic_xg(s["x"], s["y"], s.get("is_header", 0))
        goals_total = sum(1 for t in team_shots.values() for s in t if s.get("_outcome") == "Goal")
        print(f"[train] Analytic fallback applied. Continuing with wc_shots.json save...")
        api_data = {}
        from models.xg_model import SHOTS_JSON
        for team, shots in team_shots.items():
            goals     = sum(1 for s in shots if s.get("_outcome", s.get("outcome")) == "Goal")
            on_target = sum(1 for s in shots if s.get("_outcome", s.get("outcome")) in ("Goal", "Saved"))
            api_shots = [{"id": s.get("id", i), "x": s["_x"], "y": s["_y"], "xg": s["xg"],
                          "outcome": s.get("_outcome", ""), "player": s.get("_player", ""),
                          "minute": s.get("_minute", 0), "is_header": s.get("_is_header", 0),
                          "technique": s.get("_technique", "Normal")}
                         for i, s in enumerate(shots)]
            api_data[team] = {"shots": api_shots, "summary": {
                "total_shots": len(api_shots),
                "total_xg": round(sum(s["xg"] for s in api_shots), 2),
                "goals": goals, "shots_on_target": on_target
            }, "source": "statsbomb"}
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        SHOTS_JSON.write_text(json.dumps(api_data, indent=2))
        print(f"[train] Saved analytic-scored data → {SHOTS_JSON}")
        sys.exit(0)

    # 3. Train the model
    print(f"[train] Training XGBoost on {len(shots_df)} shots...")
    model = train_xg_model(shots_df)
    print("[train] Training complete.")

    # 4. Fill xG values and save API data
    print("\n[train] Computing xG for WC 2018 shot data...")
    api_data = fill_xg(model, team_shots)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SHOTS_JSON.write_text(json.dumps(api_data, indent=2))
    print(f"[train] Saved → {SHOTS_JSON}  ({len(api_data)} teams)")

    # 5. Quick summary table
    print("\n[train] Shot totals by team:")
    for team in sorted(api_data):
        s = api_data[team]["summary"]
        print(f"  {team:<22}  shots={s['total_shots']:>3}  "
              f"xG={s['total_xg']:>5.2f}  goals={s['goals']}")

    print("\n[train] Done! Restart the Flask server if it's already running.")
    print("[train] Open the xG Map tab — it now shows real StatsBomb data.")


if __name__ == "__main__":
    main()
