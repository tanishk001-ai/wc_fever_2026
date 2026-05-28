"""
Module 3: Monte Carlo Group Stage Simulator.

Given the current standings for a group (which teams are in it, how many
matches they've already played, their current points/GD), simulates the
remaining matches 10,000 times using the trained outcome_predictor to
estimate each team's probability of advancing to the Round of 16.

WC 2026 format: 12 groups of 4 teams each.
  - Top 2 from each group advance automatically.
  - Best 8 third-placed teams also advance (we ignore that edge case here
    and treat only the top-2 slots as guaranteed advancement, which is
    the conservative and clean assumption for a portfolio project).

Usage:
    from models.monte_carlo import simulate_group

    result = simulate_group(
        group_name="Group A",
        teams=["Mexico", "USA", "Iceland", "Algeria"],
        current_standings=[
            {"name": "Mexico",  "played": 1, "won": 1, "draw": 0, "lost": 0,
             "points": 3, "goal_diff": 1},
            ...
        ]
    )
    # result["teams"] -> list of dicts with "advancement_prob" added
"""

from __future__ import annotations

import itertools
import random
from typing import Any

# Import the existing predictor — don't rewrite, just reuse.
from models.outcome_predictor import predict_match

# Number of simulated tournaments per call.
N_ITERATIONS = 10_000

# WC 2026 hosts (for the predictor's host feature).
HOST = "USA"


# ---------------------------------------------------------------------------
# Schedule helpers
# ---------------------------------------------------------------------------

def _berger_schedule(teams: list[str]) -> list[list[tuple[str, str]]]:
    """
    Generate a complete round-robin schedule using the Berger method.

    For n teams (even), fixes the last team and rotates the rest.
    Each round contains n/2 matches; every team appears exactly once per round.

    Example for 4 teams [M, U, I, A]:
      Round 1: (M, A), (U, I)
      Round 2: (I, A), (M, U)
      Round 3: (U, A), (I, M)

    Returns a list of rounds, each round is a list of (home, away) pairs.
    """
    n = len(teams)
    fixed = teams[-1]
    rotating = list(teams[:-1])
    rounds = []

    for _ in range(n - 1):
        # First pair: rotating[0] vs the fixed team
        pairs = [(rotating[0], fixed)]
        # Remaining pairs: mirror from both ends of the rotating list
        for i in range(1, n // 2):
            pairs.append((rotating[i], rotating[n - 1 - i]))
        rounds.append(pairs)
        # Rotate: last element moves to front
        rotating = [rotating[-1]] + rotating[:-1]

    return rounds


def _remaining_fixtures(
    teams: list[str],
    base: dict[str, dict],
) -> list[tuple[str, str]]:
    """
    Return the fixtures that still need to be played.

    Strategy:
    - If all teams have the same `played` count (the normal case where
      rounds are played together), use the Berger schedule: the first
      `played` rounds are done, simulate the rest.
    - If played counts differ (mid-round state), fall back to a greedy
      assignment that satisfies each team's remaining game count.

    In both cases we NEVER re-simulate a match whose result is already
    reflected in `base`, so there is no double-counting of points.
    """
    played_counts = [base[t]["played"] for t in teams]
    matches_per_team = len(teams) - 1  # each team plays every other team once

    if len(set(played_counts)) == 1:
        # All teams at the same round — use Berger schedule.
        rounds_done = played_counts[0]
        all_rounds = _berger_schedule(teams)
        remaining: list[tuple[str, str]] = []
        for round_pairs in all_rounds[rounds_done:]:
            remaining.extend(round_pairs)
        return remaining

    # Mixed state — greedy assignment.
    # This handles edge cases where the API returns teams mid-round.
    remaining_needed = {t: matches_per_team - base[t]["played"] for t in teams}
    fixtures: list[tuple[str, str]] = []
    for a, b in itertools.combinations(teams, 2):
        if remaining_needed[a] > 0 and remaining_needed[b] > 0:
            fixtures.append((a, b))
            remaining_needed[a] -= 1
            remaining_needed[b] -= 1
    return fixtures


# ---------------------------------------------------------------------------
# Outcome sampling
# ---------------------------------------------------------------------------

def _sample_outcome(probs: dict[str, float]) -> str:
    """
    Sample a single match outcome ('a_win', 'draw', 'b_win') from
    the predictor's probability dict.
    """
    outcomes = ["a_win", "draw", "b_win"]
    weights = [probs["a_win"], probs["draw"], probs["b_win"]]
    return random.choices(outcomes, weights=weights, k=1)[0]


def _apply_outcome(
    standings: dict[str, dict],
    team_a: str,
    team_b: str,
    outcome: str,
) -> None:
    """
    Update the mutable standings dict in-place for one match result.
    Points: win=3, draw=1, loss=0.
    GD is approximated as +1/-1 for a win/loss, 0 for draw
    (we don't simulate scorelines — keeping it simple).
    """
    if outcome == "a_win":
        standings[team_a]["points"]    += 3
        standings[team_a]["won"]       += 1
        standings[team_a]["goal_diff"] += 1
        standings[team_b]["lost"]      += 1
        standings[team_b]["goal_diff"] -= 1
    elif outcome == "b_win":
        standings[team_b]["points"]    += 3
        standings[team_b]["won"]       += 1
        standings[team_b]["goal_diff"] += 1
        standings[team_a]["lost"]      += 1
        standings[team_a]["goal_diff"] -= 1
    else:  # draw
        standings[team_a]["points"] += 1
        standings[team_a]["draw"]   += 1
        standings[team_b]["points"] += 1
        standings[team_b]["draw"]   += 1

    standings[team_a]["played"] += 1
    standings[team_b]["played"] += 1


def _rank_teams(standings: dict[str, dict]) -> list[str]:
    """
    Sort teams by WC tiebreaker rules:
      1. Points (desc)
      2. Goal difference (desc)
      3. Alphabetical name (deterministic fallback; real rules use GF, H2H, etc.)
    Returns team names from 1st to last place.
    """
    return sorted(
        standings.keys(),
        key=lambda t: (-standings[t]["points"], -standings[t]["goal_diff"], t),
    )


# ---------------------------------------------------------------------------
# Probability cache — avoids calling the model O(N × fixtures) times.
# For a 4-team group there are at most 6 fixtures; we pre-warm all of them.
# ---------------------------------------------------------------------------

_prob_cache: dict[tuple[str, str], dict[str, float]] = {}


def _get_probs(team_a: str, team_b: str) -> dict[str, float]:
    """Cached call to outcome_predictor.predict_match."""
    key = (team_a, team_b)
    if key not in _prob_cache:
        result = predict_match(team_a, team_b, stage="GROUP", host=HOST)
        _prob_cache[key] = result["probabilities"]
    return _prob_cache[key]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def simulate_group(
    group_name: str,
    teams: list[str],
    current_standings: list[dict[str, Any]],
    n_iterations: int = N_ITERATIONS,
) -> dict[str, Any]:
    """
    Run Monte Carlo simulation for one group.

    Args:
        group_name:        e.g. "Group A"
        teams:             list of 4 team name strings
        current_standings: list of dicts with keys:
                           name, played, won, draw, lost, points, goal_diff
        n_iterations:      number of simulated completions (default 10 000)

    Returns:
        {
          "group": "Group A",
          "teams": [
            {
              "name": "Mexico", "played": 1, "won": 1, "draw": 0, "lost": 0,
              "points": 3, "goal_diff": 1, "advancement_prob": 0.84
            },
            ...  (sorted by points desc, then goal_diff desc)
          ]
        }
    """
    # Build a clean lookup from current standings.
    base: dict[str, dict] = {row["name"]: dict(row) for row in current_standings}

    # Determine which fixtures remain (no double-counting of played matches).
    fixtures = _remaining_fixtures(teams, base)

    # Pre-warm the probability cache for all remaining fixtures.
    for a, b in fixtures:
        _get_probs(a, b)

    # Count how many times each team finishes in the top 2.
    advance_counts: dict[str, int] = {t: 0 for t in teams}

    for _ in range(n_iterations):
        # Deep-copy base standings for this simulation run.
        sim = {t: dict(base[t]) for t in teams}

        # Simulate each remaining match by sampling from the predictor's probs.
        for a, b in fixtures:
            probs = _get_probs(a, b)
            outcome = _sample_outcome(probs)
            _apply_outcome(sim, a, b, outcome)

        # Rank teams and credit the top-2 finishers with an advancement.
        ranked = _rank_teams(sim)
        advance_counts[ranked[0]] += 1
        advance_counts[ranked[1]] += 1

    # Merge base standings with computed advancement probabilities.
    result_teams = [
        {**row, "advancement_prob": round(advance_counts[row["name"]] / n_iterations, 4)}
        for row in current_standings
    ]

    # Sort by points desc, goal_diff desc for display.
    result_teams.sort(key=lambda r: (-r["points"], -r["goal_diff"]))

    return {
        "group": group_name,
        "teams": result_teams,
    }
