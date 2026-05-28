"""
Data fetching for the World Cup 2026 Dashboard.

Two sources:
  1. football-data.org   -> live WC 2026 fixtures and group standings (needs API key)
  2. Historical matches  -> bundled CSV of real WC 2006-2022 results (for training)

If the live API is unavailable, we fall back to cached/hardcoded values so the
demo never breaks.
"""

import os
import csv
import json
from pathlib import Path
from datetime import datetime

import requests
from dotenv import load_dotenv

# Load env vars from backend/.env if present
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

API_KEY = os.getenv("FOOTBALL_DATA_API_KEY", "YOUR_API_KEY")
API_BASE = "https://api.football-data.org/v4"
HEADERS = {"X-Auth-Token": API_KEY}

DATA_DIR = Path(__file__).resolve().parent
HISTORICAL_CSV = DATA_DIR / "historical_matches.csv"
FIXTURES_CACHE = DATA_DIR / "fixtures_cache.json"
STANDINGS_CACHE = DATA_DIR / "standings_cache.json"

# ---------------------------------------------------------------------------
# Historical WC match data (2006 - 2022)
# ---------------------------------------------------------------------------
# Format: (year, stage, team_a, team_b, score_a, score_b, host)
# stage codes: GROUP, R16, QF, SF, 3RD, FINAL
# This is a curated sample of real World Cup matches used to train the model.
# It intentionally favors high-profile games to keep the file small while still
# capturing tournament dynamics.

REAL_WC_MATCHES = [
    # 2006 Germany
    (2006, "GROUP", "Germany", "Costa Rica", 4, 2, "Germany"),
    (2006, "GROUP", "England", "Paraguay", 1, 0, "Germany"),
    (2006, "GROUP", "Argentina", "Ivory Coast", 2, 1, "Germany"),
    (2006, "GROUP", "Netherlands", "Serbia", 1, 0, "Germany"),
    (2006, "GROUP", "Mexico", "Iran", 3, 1, "Germany"),
    (2006, "GROUP", "Italy", "Ghana", 2, 0, "Germany"),
    (2006, "GROUP", "Brazil", "Croatia", 1, 0, "Germany"),
    (2006, "GROUP", "France", "Switzerland", 0, 0, "Germany"),
    (2006, "GROUP", "Spain", "Ukraine", 4, 0, "Germany"),
    (2006, "GROUP", "Portugal", "Angola", 1, 0, "Germany"),
    (2006, "R16",   "Germany", "Sweden", 2, 0, "Germany"),
    (2006, "R16",   "Argentina", "Mexico", 2, 1, "Germany"),
    (2006, "R16",   "England", "Ecuador", 1, 0, "Germany"),
    (2006, "R16",   "Portugal", "Netherlands", 1, 0, "Germany"),
    (2006, "R16",   "Italy", "Australia", 1, 0, "Germany"),
    (2006, "R16",   "Brazil", "Ghana", 3, 0, "Germany"),
    (2006, "R16",   "France", "Spain", 3, 1, "Germany"),
    (2006, "QF",    "Germany", "Argentina", 1, 1, "Germany"),
    (2006, "QF",    "Italy", "Ukraine", 3, 0, "Germany"),
    (2006, "QF",    "Portugal", "England", 0, 0, "Germany"),
    (2006, "QF",    "France", "Brazil", 1, 0, "Germany"),
    (2006, "SF",    "Italy", "Germany", 2, 0, "Germany"),
    (2006, "SF",    "France", "Portugal", 1, 0, "Germany"),
    (2006, "3RD",   "Germany", "Portugal", 3, 1, "Germany"),
    (2006, "FINAL", "Italy", "France", 1, 1, "Germany"),

    # 2010 South Africa
    (2010, "GROUP", "South Africa", "Mexico", 1, 1, "South Africa"),
    (2010, "GROUP", "Argentina", "Nigeria", 1, 0, "South Africa"),
    (2010, "GROUP", "Germany", "Australia", 4, 0, "South Africa"),
    (2010, "GROUP", "Netherlands", "Denmark", 2, 0, "South Africa"),
    (2010, "GROUP", "Brazil", "North Korea", 2, 1, "South Africa"),
    (2010, "GROUP", "Spain", "Switzerland", 0, 1, "South Africa"),
    (2010, "GROUP", "Italy", "Paraguay", 1, 1, "South Africa"),
    (2010, "GROUP", "England", "USA", 1, 1, "South Africa"),
    (2010, "GROUP", "France", "Uruguay", 0, 0, "South Africa"),
    (2010, "GROUP", "Portugal", "Ivory Coast", 0, 0, "South Africa"),
    (2010, "R16",   "Uruguay", "South Korea", 2, 1, "South Africa"),
    (2010, "R16",   "Ghana", "USA", 2, 1, "South Africa"),
    (2010, "R16",   "Germany", "England", 4, 1, "South Africa"),
    (2010, "R16",   "Argentina", "Mexico", 3, 1, "South Africa"),
    (2010, "R16",   "Netherlands", "Slovakia", 2, 1, "South Africa"),
    (2010, "R16",   "Brazil", "Chile", 3, 0, "South Africa"),
    (2010, "R16",   "Paraguay", "Japan", 0, 0, "South Africa"),
    (2010, "R16",   "Spain", "Portugal", 1, 0, "South Africa"),
    (2010, "QF",    "Netherlands", "Brazil", 2, 1, "South Africa"),
    (2010, "QF",    "Uruguay", "Ghana", 1, 1, "South Africa"),
    (2010, "QF",    "Germany", "Argentina", 4, 0, "South Africa"),
    (2010, "QF",    "Spain", "Paraguay", 1, 0, "South Africa"),
    (2010, "SF",    "Netherlands", "Uruguay", 3, 2, "South Africa"),
    (2010, "SF",    "Spain", "Germany", 1, 0, "South Africa"),
    (2010, "3RD",   "Germany", "Uruguay", 3, 2, "South Africa"),
    (2010, "FINAL", "Spain", "Netherlands", 1, 0, "South Africa"),

    # 2014 Brazil
    (2014, "GROUP", "Brazil", "Croatia", 3, 1, "Brazil"),
    (2014, "GROUP", "Mexico", "Cameroon", 1, 0, "Brazil"),
    (2014, "GROUP", "Netherlands", "Spain", 5, 1, "Brazil"),
    (2014, "GROUP", "Chile", "Australia", 3, 1, "Brazil"),
    (2014, "GROUP", "Colombia", "Greece", 3, 0, "Brazil"),
    (2014, "GROUP", "Ivory Coast", "Japan", 2, 1, "Brazil"),
    (2014, "GROUP", "Uruguay", "Costa Rica", 1, 3, "Brazil"),
    (2014, "GROUP", "England", "Italy", 1, 2, "Brazil"),
    (2014, "GROUP", "Switzerland", "Ecuador", 2, 1, "Brazil"),
    (2014, "GROUP", "France", "Honduras", 3, 0, "Brazil"),
    (2014, "GROUP", "Argentina", "Bosnia", 2, 1, "Brazil"),
    (2014, "GROUP", "Germany", "Portugal", 4, 0, "Brazil"),
    (2014, "GROUP", "USA", "Ghana", 2, 1, "Brazil"),
    (2014, "GROUP", "Belgium", "Algeria", 2, 1, "Brazil"),
    (2014, "GROUP", "Russia", "South Korea", 1, 1, "Brazil"),
    (2014, "R16",   "Brazil", "Chile", 1, 1, "Brazil"),
    (2014, "R16",   "Colombia", "Uruguay", 2, 0, "Brazil"),
    (2014, "R16",   "Netherlands", "Mexico", 2, 1, "Brazil"),
    (2014, "R16",   "Costa Rica", "Greece", 1, 1, "Brazil"),
    (2014, "R16",   "France", "Nigeria", 2, 0, "Brazil"),
    (2014, "R16",   "Germany", "Algeria", 2, 1, "Brazil"),
    (2014, "R16",   "Argentina", "Switzerland", 1, 0, "Brazil"),
    (2014, "R16",   "Belgium", "USA", 2, 1, "Brazil"),
    (2014, "QF",    "France", "Germany", 0, 1, "Brazil"),
    (2014, "QF",    "Brazil", "Colombia", 2, 1, "Brazil"),
    (2014, "QF",    "Argentina", "Belgium", 1, 0, "Brazil"),
    (2014, "QF",    "Netherlands", "Costa Rica", 0, 0, "Brazil"),
    (2014, "SF",    "Brazil", "Germany", 1, 7, "Brazil"),
    (2014, "SF",    "Netherlands", "Argentina", 0, 0, "Brazil"),
    (2014, "3RD",   "Brazil", "Netherlands", 0, 3, "Brazil"),
    (2014, "FINAL", "Germany", "Argentina", 1, 0, "Brazil"),

    # 2018 Russia
    (2018, "GROUP", "Russia", "Saudi Arabia", 5, 0, "Russia"),
    (2018, "GROUP", "Egypt", "Uruguay", 0, 1, "Russia"),
    (2018, "GROUP", "Morocco", "Iran", 0, 1, "Russia"),
    (2018, "GROUP", "Portugal", "Spain", 3, 3, "Russia"),
    (2018, "GROUP", "France", "Australia", 2, 1, "Russia"),
    (2018, "GROUP", "Argentina", "Iceland", 1, 1, "Russia"),
    (2018, "GROUP", "Peru", "Denmark", 0, 1, "Russia"),
    (2018, "GROUP", "Croatia", "Nigeria", 2, 0, "Russia"),
    (2018, "GROUP", "Brazil", "Switzerland", 1, 1, "Russia"),
    (2018, "GROUP", "Germany", "Mexico", 0, 1, "Russia"),
    (2018, "GROUP", "Sweden", "South Korea", 1, 0, "Russia"),
    (2018, "GROUP", "Belgium", "Panama", 3, 0, "Russia"),
    (2018, "GROUP", "Tunisia", "England", 1, 2, "Russia"),
    (2018, "GROUP", "Colombia", "Japan", 1, 2, "Russia"),
    (2018, "GROUP", "Poland", "Senegal", 1, 2, "Russia"),
    (2018, "R16",   "France", "Argentina", 4, 3, "Russia"),
    (2018, "R16",   "Uruguay", "Portugal", 2, 1, "Russia"),
    (2018, "R16",   "Spain", "Russia", 1, 1, "Russia"),
    (2018, "R16",   "Croatia", "Denmark", 1, 1, "Russia"),
    (2018, "R16",   "Brazil", "Mexico", 2, 0, "Russia"),
    (2018, "R16",   "Belgium", "Japan", 3, 2, "Russia"),
    (2018, "R16",   "Sweden", "Switzerland", 1, 0, "Russia"),
    (2018, "R16",   "Colombia", "England", 1, 1, "Russia"),
    (2018, "QF",    "France", "Uruguay", 2, 0, "Russia"),
    (2018, "QF",    "Russia", "Croatia", 2, 2, "Russia"),
    (2018, "QF",    "Brazil", "Belgium", 1, 2, "Russia"),
    (2018, "QF",    "Sweden", "England", 0, 2, "Russia"),
    (2018, "SF",    "France", "Belgium", 1, 0, "Russia"),
    (2018, "SF",    "Croatia", "England", 2, 1, "Russia"),
    (2018, "3RD",   "Belgium", "England", 2, 0, "Russia"),
    (2018, "FINAL", "France", "Croatia", 4, 2, "Russia"),

    # 2022 Qatar
    (2022, "GROUP", "Qatar", "Ecuador", 0, 2, "Qatar"),
    (2022, "GROUP", "England", "Iran", 6, 2, "Qatar"),
    (2022, "GROUP", "Senegal", "Netherlands", 0, 2, "Qatar"),
    (2022, "GROUP", "USA", "Wales", 1, 1, "Qatar"),
    (2022, "GROUP", "Argentina", "Saudi Arabia", 1, 2, "Qatar"),
    (2022, "GROUP", "Denmark", "Tunisia", 0, 0, "Qatar"),
    (2022, "GROUP", "Mexico", "Poland", 0, 0, "Qatar"),
    (2022, "GROUP", "France", "Australia", 4, 1, "Qatar"),
    (2022, "GROUP", "Morocco", "Croatia", 0, 0, "Qatar"),
    (2022, "GROUP", "Germany", "Japan", 1, 2, "Qatar"),
    (2022, "GROUP", "Spain", "Costa Rica", 7, 0, "Qatar"),
    (2022, "GROUP", "Belgium", "Canada", 1, 0, "Qatar"),
    (2022, "GROUP", "Switzerland", "Cameroon", 1, 0, "Qatar"),
    (2022, "GROUP", "Uruguay", "South Korea", 0, 0, "Qatar"),
    (2022, "GROUP", "Portugal", "Ghana", 3, 2, "Qatar"),
    (2022, "GROUP", "Brazil", "Serbia", 2, 0, "Qatar"),
    (2022, "R16",   "Netherlands", "USA", 3, 1, "Qatar"),
    (2022, "R16",   "Argentina", "Australia", 2, 1, "Qatar"),
    (2022, "R16",   "France", "Poland", 3, 1, "Qatar"),
    (2022, "R16",   "England", "Senegal", 3, 0, "Qatar"),
    (2022, "R16",   "Japan", "Croatia", 1, 1, "Qatar"),
    (2022, "R16",   "Brazil", "South Korea", 4, 1, "Qatar"),
    (2022, "R16",   "Morocco", "Spain", 0, 0, "Qatar"),
    (2022, "R16",   "Portugal", "Switzerland", 6, 1, "Qatar"),
    (2022, "QF",    "Croatia", "Brazil", 1, 1, "Qatar"),
    (2022, "QF",    "Netherlands", "Argentina", 2, 2, "Qatar"),
    (2022, "QF",    "Morocco", "Portugal", 1, 0, "Qatar"),
    (2022, "QF",    "England", "France", 1, 2, "Qatar"),
    (2022, "SF",    "Argentina", "Croatia", 3, 0, "Qatar"),
    (2022, "SF",    "France", "Morocco", 2, 0, "Qatar"),
    (2022, "3RD",   "Croatia", "Morocco", 2, 1, "Qatar"),
    (2022, "FINAL", "Argentina", "France", 3, 3, "Qatar"),
]

# Approximated FIFA rankings per team across this period.
# Real values vary by year; for a portfolio model this single snapshot is
# a reasonable proxy. Lower number = stronger team.
FIFA_RANKS = {
    "Argentina": 1, "France": 2, "Brazil": 3, "England": 4, "Belgium": 5,
    "Netherlands": 6, "Portugal": 7, "Spain": 8, "Italy": 9, "Croatia": 10,
    "Morocco": 13, "Germany": 14, "Switzerland": 17, "USA": 16, "Mexico": 12,
    "Uruguay": 11, "Denmark": 18, "Senegal": 19, "Japan": 20, "South Korea": 23,
    "Poland": 26, "Sweden": 27, "Wales": 30, "Australia": 27, "Iran": 21,
    "Serbia": 24, "Ecuador": 31, "Tunisia": 30, "Cameroon": 43, "Canada": 41,
    "Ghana": 60, "Saudi Arabia": 51, "Costa Rica": 31, "Qatar": 50,
    "Russia": 35, "Egypt": 32, "Iceland": 22, "Peru": 21, "Nigeria": 25,
    "Panama": 49, "Colombia": 17, "Chile": 19, "Greece": 12, "Ivory Coast": 22,
    "Bosnia": 25, "Honduras": 33, "Algeria": 22, "Slovakia": 34,
    "North Korea": 105, "Paraguay": 30, "South Africa": 83, "Ukraine": 30,
    "Angola": 60, "Czech Republic": 28, "Togo": 56, "Trinidad and Tobago": 51,
    "Saudi Arabia": 51, "Ghana": 60,
}


def get_fifa_rank(team: str) -> int:
    """FIFA rank lookup with a sensible default for unknown teams."""
    return FIFA_RANKS.get(team, 70)


# ---------------------------------------------------------------------------
# World Cup historical achievement data (hard-coded historical facts)
# ---------------------------------------------------------------------------

WC_HISTORY = {
    "Brazil":       {"titles": 5, "finals": 7, "appearances": 22, "best_finish": "5× Champion"},
    "Germany":      {"titles": 4, "finals": 8, "appearances": 20, "best_finish": "4× Champion"},
    "Italy":        {"titles": 4, "finals": 6, "appearances": 18, "best_finish": "4× Champion"},
    "Argentina":    {"titles": 3, "finals": 5, "appearances": 18, "best_finish": "3× Champion"},
    "France":       {"titles": 2, "finals": 3, "appearances": 15, "best_finish": "2× Champion"},
    "Uruguay":      {"titles": 2, "finals": 3, "appearances": 14, "best_finish": "2× Champion"},
    "England":      {"titles": 1, "finals": 1, "appearances": 16, "best_finish": "Champion (1966)"},
    "Spain":        {"titles": 1, "finals": 1, "appearances": 15, "best_finish": "Champion (2010)"},
    "Netherlands":  {"titles": 0, "finals": 3, "appearances": 11, "best_finish": "Runner-up"},
    "Croatia":      {"titles": 0, "finals": 1, "appearances": 6,  "best_finish": "Runner-up (2018)"},
    "Sweden":       {"titles": 0, "finals": 1, "appearances": 12, "best_finish": "Runner-up (1958)"},
    "Hungary":      {"titles": 0, "finals": 2, "appearances": 9,  "best_finish": "Runner-up"},
    "Portugal":     {"titles": 0, "finals": 0, "appearances": 8,  "best_finish": "3rd Place (2006)"},
    "Belgium":      {"titles": 0, "finals": 0, "appearances": 14, "best_finish": "3rd Place (2018)"},
    "Poland":       {"titles": 0, "finals": 0, "appearances": 9,  "best_finish": "3rd Place"},
    "Chile":        {"titles": 0, "finals": 0, "appearances": 9,  "best_finish": "3rd Place (1962)"},
    "Austria":      {"titles": 0, "finals": 0, "appearances": 7,  "best_finish": "3rd Place (1954)"},
    "USA":          {"titles": 0, "finals": 0, "appearances": 11, "best_finish": "Semis (1930)"},
    "Morocco":      {"titles": 0, "finals": 0, "appearances": 6,  "best_finish": "4th Place (2022)"},
    "South Korea":  {"titles": 0, "finals": 0, "appearances": 10, "best_finish": "4th Place (2002)"},
    "Russia":       {"titles": 0, "finals": 0, "appearances": 11, "best_finish": "4th Place (1966)"},
    "Mexico":       {"titles": 0, "finals": 0, "appearances": 17, "best_finish": "QF (×2)"},
    "Denmark":      {"titles": 0, "finals": 0, "appearances": 6,  "best_finish": "QF (2002)"},
    "Switzerland":  {"titles": 0, "finals": 0, "appearances": 12, "best_finish": "QF (1954)"},
    "Colombia":     {"titles": 0, "finals": 0, "appearances": 6,  "best_finish": "QF (2014)"},
    "Japan":        {"titles": 0, "finals": 0, "appearances": 7,  "best_finish": "QF (2022)"},
    "Australia":    {"titles": 0, "finals": 0, "appearances": 6,  "best_finish": "QF (2006)"},
    "Senegal":      {"titles": 0, "finals": 0, "appearances": 3,  "best_finish": "QF (2002)"},
    "Peru":         {"titles": 0, "finals": 0, "appearances": 5,  "best_finish": "QF (1970)"},
    "Costa Rica":   {"titles": 0, "finals": 0, "appearances": 5,  "best_finish": "QF (2014)"},
    "Iran":         {"titles": 0, "finals": 0, "appearances": 6,  "best_finish": "Group Stage"},
    "Saudi Arabia": {"titles": 0, "finals": 0, "appearances": 6,  "best_finish": "R16 (1994)"},
    "Nigeria":      {"titles": 0, "finals": 0, "appearances": 7,  "best_finish": "R16"},
    "Serbia":       {"titles": 0, "finals": 0, "appearances": 13, "best_finish": "Runner-up (as Yugo.)"},
    "Ghana":        {"titles": 0, "finals": 0, "appearances": 4,  "best_finish": "QF (2010)"},
    "Ecuador":      {"titles": 0, "finals": 0, "appearances": 4,  "best_finish": "R16"},
    "Tunisia":      {"titles": 0, "finals": 0, "appearances": 6,  "best_finish": "Group Stage"},
    "Canada":       {"titles": 0, "finals": 0, "appearances": 2,  "best_finish": "Group Stage"},
    "Wales":        {"titles": 0, "finals": 0, "appearances": 2,  "best_finish": "QF (1958)"},
    "Iceland":      {"titles": 0, "finals": 0, "appearances": 1,  "best_finish": "Group Stage"},
    "Panama":       {"titles": 0, "finals": 0, "appearances": 1,  "best_finish": "Group Stage"},
    "Ivory Coast":  {"titles": 0, "finals": 0, "appearances": 3,  "best_finish": "Group Stage"},
    "Egypt":        {"titles": 0, "finals": 0, "appearances": 3,  "best_finish": "Group Stage"},
    "Bosnia":       {"titles": 0, "finals": 0, "appearances": 1,  "best_finish": "Group Stage"},
    "Honduras":     {"titles": 0, "finals": 0, "appearances": 3,  "best_finish": "Group Stage"},
    "Algeria":      {"titles": 0, "finals": 0, "appearances": 4,  "best_finish": "R16 (2014)"},
    "Cameroon":     {"titles": 0, "finals": 0, "appearances": 8,  "best_finish": "QF (1990)"},
}


def get_team_wc_stats(team: str) -> dict:
    """
    Return a team's World Cup statistics combining hard-coded history facts
    with recent form computed from the REAL_WC_MATCHES training data.

    Returns:
        titles, appearances, best_finish (from WC_HISTORY lookup)
        total_games, wins, draws, losses, goals_for, goals_against (from dataset)
        recent_form: list of up to 5 most recent results as 'W', 'D', or 'L'
    """
    hist = WC_HISTORY.get(team, {
        "titles": 0, "finals": 0, "appearances": 1, "best_finish": "Group Stage"
    })

    # Compute record + form from training dataset (ordered chronologically)
    wins = draws = losses = goals_for = goals_against = 0
    form_results = []  # chronological W/D/L

    for year, stage, team_a, team_b, score_a, score_b, host in REAL_WC_MATCHES:
        if team_a == team or team_b == team:
            if team_a == team:
                gf, ga = score_a, score_b
            else:
                gf, ga = score_b, score_a

            goals_for += gf
            goals_against += ga

            if gf > ga:
                wins += 1
                form_results.append("W")
            elif gf == ga:
                draws += 1
                form_results.append("D")
            else:
                losses += 1
                form_results.append("L")

    return {
        "titles":        hist["titles"],
        "appearances":   hist["appearances"],
        "best_finish":   hist["best_finish"],
        "total_games":   wins + draws + losses,
        "wins":          wins,
        "draws":         draws,
        "losses":        losses,
        "goals_for":     goals_for,
        "goals_against": goals_against,
        "recent_form":   form_results[-5:],  # last 5 WC game results
    }


def write_historical_csv() -> Path:
    """Materialize the historical match list as a CSV the model can read."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with HISTORICAL_CSV.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "year", "stage", "team_a", "team_b",
            "score_a", "score_b", "host",
        ])
        for row in REAL_WC_MATCHES:
            writer.writerow(row)
    return HISTORICAL_CSV


# ---------------------------------------------------------------------------
# Live API calls (football-data.org)
# ---------------------------------------------------------------------------

def _api_get(path: str, params: dict | None = None) -> dict | None:
    """Tiny wrapper around requests.get with API key + safe failure."""
    if API_KEY == "YOUR_API_KEY":
        # No key configured -- caller will use fallback data.
        return None
    try:
        resp = requests.get(
            f"{API_BASE}{path}",
            headers=HEADERS,
            params=params,
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
        print(f"[fetch_data] API returned {resp.status_code} for {path}")
    except requests.RequestException as exc:
        print(f"[fetch_data] API request failed: {exc}")
    return None


def fetch_upcoming_fixtures() -> list[dict]:
    """
    Return a list of upcoming WC 2026 fixtures the user can predict.

    Falls back to a hardcoded plausible fixture list if the API is unreachable.
    """
    data = _api_get("/competitions/WC/matches", {"status": "SCHEDULED"})
    if data and "matches" in data:
        fixtures = [
            {
                "id": m["id"],
                "team_a": m["homeTeam"]["name"],
                "team_b": m["awayTeam"]["name"],
                "utc_date": m["utcDate"],
                "stage": m.get("stage", "GROUP_STAGE"),
            }
            for m in data["matches"]
        ]
        FIXTURES_CACHE.write_text(json.dumps(fixtures, indent=2))
        return fixtures

    # Fallback: cached file if it exists
    if FIXTURES_CACHE.exists():
        return json.loads(FIXTURES_CACHE.read_text())

    # Final fallback: hardcoded sample fixtures (WC 2026 hosts: USA, Canada, Mexico)
    return [
        {"id": 1, "team_a": "USA", "team_b": "Mexico", "utc_date": "2026-06-12T20:00:00Z", "stage": "GROUP"},
        {"id": 2, "team_a": "Argentina", "team_b": "Brazil", "utc_date": "2026-06-13T20:00:00Z", "stage": "GROUP"},
        {"id": 3, "team_a": "France", "team_b": "Germany", "utc_date": "2026-06-14T20:00:00Z", "stage": "GROUP"},
        {"id": 4, "team_a": "England", "team_b": "Spain", "utc_date": "2026-06-15T20:00:00Z", "stage": "GROUP"},
        {"id": 5, "team_a": "Portugal", "team_b": "Netherlands", "utc_date": "2026-06-16T20:00:00Z", "stage": "GROUP"},
        {"id": 6, "team_a": "Belgium", "team_b": "Croatia", "utc_date": "2026-06-17T20:00:00Z", "stage": "GROUP"},
        {"id": 7, "team_a": "Morocco", "team_b": "Italy", "utc_date": "2026-06-18T20:00:00Z", "stage": "GROUP"},
        {"id": 8, "team_a": "Japan", "team_b": "South Korea", "utc_date": "2026-06-19T20:00:00Z", "stage": "GROUP"},
        {"id": 9, "team_a": "Uruguay", "team_b": "Colombia", "utc_date": "2026-06-20T20:00:00Z", "stage": "GROUP"},
        {"id": 10, "team_a": "Canada", "team_b": "Switzerland", "utc_date": "2026-06-21T20:00:00Z", "stage": "GROUP"},
    ]


def fetch_group_standings() -> list[dict]:
    """
    Return current WC 2026 group standings.

    Falls back to a hardcoded mid-tournament snapshot if the API is unreachable.
    """
    data = _api_get("/competitions/WC/standings")
    if data and "standings" in data:
        groups = []
        for s in data["standings"]:
            if s.get("type") != "TOTAL":
                continue
            groups.append({
                "group": s.get("group", "Unknown"),
                "teams": [
                    {
                        "name": t["team"]["name"],
                        "played": t["playedGames"],
                        "won": t["won"],
                        "draw": t["draw"],
                        "lost": t["lost"],
                        "points": t["points"],
                        "goal_diff": t["goalDifference"],
                    }
                    for t in s["table"]
                ],
            })
        STANDINGS_CACHE.write_text(json.dumps(groups, indent=2))
        return groups

    if STANDINGS_CACHE.exists():
        return json.loads(STANDINGS_CACHE.read_text())

    # Hardcoded fallback (12 groups in WC 2026; showing 4 for brevity)
    return _fallback_standings()


def _fallback_standings() -> list[dict]:
    """Cached sample standings used when no API key is configured."""
    # Each group shows 1 played round: 1 win (3 pts), 2 draws (1 pt each), 1 loss (0 pts).
    # GDs balance to zero per group: +1, 0, 0, -1.
    sample = [
        ("Group A", [("Mexico", 3, 1), ("Iceland", 1, 0), ("Algeria", 1, 0), ("USA", 0, -1)]),
        ("Group B", [("Argentina", 3, 1), ("Brazil", 1, 0), ("Portugal", 1, 0), ("Saudi Arabia", 0, -1)]),
        ("Group C", [("France", 3, 1), ("Germany", 1, 0), ("Croatia", 1, 0), ("Senegal", 0, -1)]),
        ("Group D", [("England", 3, 1), ("Spain", 1, 0), ("Belgium", 1, 0), ("Australia", 0, -1)]),
    ]
    groups = []
    for name, rows in sample:
        teams = []
        for team, pts, gd in rows:
            teams.append({
                "name": team,
                "played": 1,
                "won": 1 if pts >= 2 else 0,
                "draw": 1 if pts == 1 else 0,
                "lost": 1 if pts == 0 else 0,
                "points": pts,
                "goal_diff": gd,
            })
        groups.append({"group": name, "teams": teams})
    return groups


if __name__ == "__main__":
    path = write_historical_csv()
    print(f"Wrote {len(REAL_WC_MATCHES)} matches to {path}")
