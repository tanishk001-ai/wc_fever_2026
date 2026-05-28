"""
Repair script: re-fetches WC 2018 shot outcomes from StatsBomb and patches
wc_shots.json with the correct outcome values.

Run from the backend/ directory:
    python scripts/repair_outcomes.py

This is lightweight — it does NOT re-train the model.
It only fixes the empty 'outcome' field caused by statsbombpy 1.0+ changing
column names from 'shot_outcome' (dict) to 'shot_outcome_name' (plain string).

After it finishes, restart Flask so the API serves the updated data.
"""

import sys
import json
from pathlib import Path

# Make the backend package importable when run as a script
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from statsbombpy import sb
from models.xg_model import DATA_DIR, SHOTS_JSON


# ── Outcome extraction — handles every known statsbombpy layout ───────────────

def _safe_str(val) -> str:
    """Return val as a stripped string, or '' if it's NaN/None/empty."""
    if val is None:
        return ""
    try:
        import math
        if math.isnan(float(val)):
            return ""
    except (TypeError, ValueError):
        pass
    s = str(val).strip()
    return "" if s.lower() in ("nan", "none") else s


def extract_outcome(row) -> str:
    """
    Try every known statsbombpy column format to extract the shot outcome name.

    Priority order:
      1. shot_outcome_name  — fully-flattened string  (statsbombpy >= 1.0)
      2. shot_outcome       — dict {"id": X, "name": Y} (statsbombpy 0.9.x)
      3. row["shot"]["outcome"] — nested dict  (statsbombpy < 0.9)
    """
    # 1. Fully flattened string column (statsbombpy >= 1.0)
    val = _safe_str(row.get("shot_outcome_name"))
    if val:
        return val

    # 2. Dict-valued flat column (statsbombpy 0.9.x)
    shot_outcome = row.get("shot_outcome")
    if isinstance(shot_outcome, dict):
        val = _safe_str(shot_outcome.get("name"))
        if val:
            return val
    elif shot_outcome is not None:
        val = _safe_str(shot_outcome)
        if val:
            return val

    # 3. Legacy nested layout — row["shot"] is a dict
    shot_dict = row.get("shot")
    if isinstance(shot_dict, dict) and shot_dict:
        outcome_field = shot_dict.get("outcome")
        if isinstance(outcome_field, dict):
            val = _safe_str(outcome_field.get("name"))
            if val:
                return val
        elif outcome_field:
            val = _safe_str(outcome_field)
            if val:
                return val

    return ""


def extract_player(row) -> str:
    """Get player name regardless of whether it's a dict or string."""
    raw = row.get("player", "")
    if isinstance(raw, dict):
        return raw.get("name", "")
    return str(raw).strip() if raw else ""


def extract_team(row) -> str:
    """Get team name regardless of whether it's a dict or string."""
    raw = row.get("team", "")
    if isinstance(raw, dict):
        return raw.get("name", "")
    return str(raw).strip() if raw else ""


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not SHOTS_JSON.exists():
        print("[repair] wc_shots.json not found. Run train_xg_model.py first.")
        sys.exit(1)

    data = json.loads(SHOTS_JSON.read_text())
    total_shots_in_file = sum(len(v.get("shots", [])) for v in data.values())
    print(f"[repair] Loaded wc_shots.json — {len(data)} teams, {total_shots_in_file} shots")

    # ── Step 1: Fetch all WC 2018 outcomes from StatsBomb ────────────────────
    print("\n[repair] Fetching WC 2018 matches from StatsBomb open data...")
    try:
        matches = sb.matches(competition_id=43, season_id=3)
    except Exception as exc:
        print(f"[repair] ERROR: Could not fetch matches — {exc}")
        sys.exit(1)

    print(f"[repair] {len(matches)} matches found. Fetching shot events...")

    # Build lookup: (team, player, minute, x, y) -> outcome string
    # Key is a tuple so it's hashable; x/y are rounded to 1 dp to match the JSON.
    outcome_lookup: dict[tuple, str] = {}
    column_names_printed = False
    match_count = 0

    for _, match_row in matches.iterrows():
        match_id = int(match_row["match_id"])
        try:
            events = sb.events(match_id=match_id)
        except Exception as exc:
            print(f"[repair]   Match {match_id}: SKIP ({exc})")
            continue

        shot_events = events[events["type"] == "Shot"]
        match_count += 1

        # Print column names once so you can see what statsbombpy is returning
        if not column_names_printed and len(shot_events) > 0:
            shot_cols = sorted(c for c in shot_events.columns if "shot" in c.lower())
            print(f"\n[repair] Shot-related columns detected: {shot_cols}")
            # Show a sample row's outcome value to confirm parsing
            sample = shot_events.iloc[0]
            for col in ["shot_outcome_name", "shot_outcome", "shot"]:
                if col in shot_events.columns:
                    print(f"[repair]   {col!r}: {repr(sample.get(col))}")
            print()
            column_names_printed = True

        for _, ev in shot_events.iterrows():
            outcome = extract_outcome(ev)
            loc = ev.get("location", [0, 0])
            x = round(float(loc[0]), 1) if loc is not None and len(loc) >= 2 else 0.0
            y = round(float(loc[1]), 1) if loc is not None and len(loc) >= 2 else 0.0
            player = extract_player(ev)
            team   = extract_team(ev)
            minute = int(ev.get("minute", 0))

            key = (team, player, minute, x, y)
            outcome_lookup[key] = outcome

    non_empty = sum(1 for v in outcome_lookup.values() if v)
    print(f"[repair] Processed {match_count} matches.")
    print(f"[repair] Outcome lookup built: {len(outcome_lookup)} shots, "
          f"{non_empty} with non-empty outcomes.")

    if non_empty == 0:
        print("\n[repair] WARNING: All outcomes came back empty — "
              "statsbombpy column names may have changed again.")
        print("[repair] Run this to inspect a match manually:")
        print("  python -c \"from statsbombpy import sb; "
              "e=sb.events(match_id=8658); "
              "print(e[e['type']=='Shot'].columns.tolist())\"")
        sys.exit(1)

    # ── Step 2: Patch wc_shots.json ──────────────────────────────────────────
    print("\n[repair] Patching wc_shots.json...")
    total = patched = unmatched = 0

    for team, team_data in data.items():
        shots = team_data.get("shots", [])
        for s in shots:
            total += 1
            key = (team, s.get("player", ""), s.get("minute", 0),
                   s.get("x", 0.0), s.get("y", 0.0))
            if key in outcome_lookup:
                s["outcome"] = outcome_lookup[key]
                patched += 1
            else:
                # Key not found — leave existing value (already empty, but don't break)
                unmatched += 1

        # Recalculate per-team summary counts
        goals     = sum(1 for s in shots if s.get("outcome") == "Goal")
        on_target = sum(1 for s in shots if s.get("outcome") in ("Goal", "Saved"))
        team_data["summary"]["goals"]           = goals
        team_data["summary"]["shots_on_target"] = on_target

    SHOTS_JSON.write_text(json.dumps(data, indent=2))
    print(f"[repair] Patched {patched} / {total} shots  "
          f"({unmatched} unmatched — check logs above if large)")

    # ── Step 3: Summary table ─────────────────────────────────────────────────
    print("\n[repair] Results by team:")
    for team in sorted(data):
        s = data[team]["summary"]
        print(f"  {team:<22}  shots={s['total_shots']:>3}  "
              f"xG={s['total_xg']:>5.2f}  "
              f"goals={s['goals']:>2}  "
              f"on_target={s['shots_on_target']:>2}")

    print("\n[repair] Done! Restart Flask to serve updated data.")
    print("[repair] Open the xG Map tab — dots should now be coloured by outcome.")


if __name__ == "__main__":
    main()
