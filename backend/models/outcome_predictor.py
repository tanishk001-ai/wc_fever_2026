"""
Module 1: Match Outcome Predictor.

Trains an XGBoost classifier on historical World Cup matches (2006-2022) and
predicts win / draw / loss probabilities for a hypothetical fixture.

Features (per match, computed from the team's recent history in the CSV):
  - FIFA rank difference (team_a_rank - team_b_rank)
  - Team A goals scored / conceded in last 5 matches
  - Team B goals scored / conceded in last 5 matches
  - Head-to-head A win rate (over all prior meetings in the dataset)
  - Tournament stage (one-hot via integer code)
  - Whether team A is host nation
  - Whether team B is host nation

Output: probabilities for [A_WIN, DRAW, B_WIN].
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, log_loss
from xgboost import XGBClassifier

from data.fetch_data import (
    HISTORICAL_CSV,
    write_historical_csv,
    get_fifa_rank,
    get_team_wc_stats,
)

MODEL_DIR = Path(__file__).resolve().parent
MODEL_PATH = MODEL_DIR / "outcome_predictor.pkl"

# Stage -> integer code. Later stages get higher numbers so the model can
# pick up on "knockout stakes" signal if it matters.
STAGE_CODES = {"GROUP": 0, "R16": 1, "QF": 2, "SF": 3, "3RD": 4, "FINAL": 5}

# Class labels for the three-way classifier.
CLASS_A_WIN = 0
CLASS_DRAW = 1
CLASS_B_WIN = 2


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------

def _match_result(score_a: int, score_b: int) -> int:
    if score_a > score_b:
        return CLASS_A_WIN
    if score_a < score_b:
        return CLASS_B_WIN
    return CLASS_DRAW


def _recent_form(history: pd.DataFrame, team: str, before_idx: int) -> tuple[float, float]:
    """
    Average (goals_scored, goals_conceded) over the team's last 5 matches
    that appear BEFORE `before_idx` in the history DataFrame.
    """
    past = history.iloc[:before_idx]
    rows = past[(past["team_a"] == team) | (past["team_b"] == team)].tail(5)
    if rows.empty:
        return 1.2, 1.2  # neutral prior

    scored, conceded = [], []
    for _, r in rows.iterrows():
        if r["team_a"] == team:
            scored.append(r["score_a"])
            conceded.append(r["score_b"])
        else:
            scored.append(r["score_b"])
            conceded.append(r["score_a"])
    return float(np.mean(scored)), float(np.mean(conceded))


def _h2h_winrate(history: pd.DataFrame, team_a: str, team_b: str, before_idx: int) -> float:
    """Win rate of team_a vs team_b across all prior meetings in the dataset."""
    past = history.iloc[:before_idx]
    mask = (
        ((past["team_a"] == team_a) & (past["team_b"] == team_b))
        | ((past["team_a"] == team_b) & (past["team_b"] == team_a))
    )
    meetings = past[mask]
    if meetings.empty:
        return 0.5  # no info -> neutral

    wins = 0
    for _, r in meetings.iterrows():
        if r["team_a"] == team_a and r["score_a"] > r["score_b"]:
            wins += 1
        elif r["team_b"] == team_a and r["score_b"] > r["score_a"]:
            wins += 1
    return wins / len(meetings)


def build_feature_row(
    team_a: str,
    team_b: str,
    stage: str,
    host: str,
    history: pd.DataFrame,
    before_idx: int | None = None,
) -> dict:
    """Build a single feature dict. `before_idx` lets us avoid leakage at train time."""
    idx = before_idx if before_idx is not None else len(history)
    a_scored, a_conceded = _recent_form(history, team_a, idx)
    b_scored, b_conceded = _recent_form(history, team_b, idx)
    h2h = _h2h_winrate(history, team_a, team_b, idx)
    return {
        "rank_diff": get_fifa_rank(team_a) - get_fifa_rank(team_b),
        "a_goals_l5": a_scored,
        "a_conceded_l5": a_conceded,
        "b_goals_l5": b_scored,
        "b_conceded_l5": b_conceded,
        "h2h_a_winrate": h2h,
        "stage_code": STAGE_CODES.get(stage, 0),
        "a_is_host": int(team_a == host),
        "b_is_host": int(team_b == host),
    }


FEATURE_COLUMNS = [
    "rank_diff", "a_goals_l5", "a_conceded_l5", "b_goals_l5", "b_conceded_l5",
    "h2h_a_winrate", "stage_code", "a_is_host", "b_is_host",
]


def _build_training_frame() -> tuple[pd.DataFrame, pd.Series]:
    """Load the CSV and build (X, y) for training."""
    if not HISTORICAL_CSV.exists():
        write_historical_csv()

    history = pd.read_csv(HISTORICAL_CSV)
    rows, labels = [], []
    for i, r in history.iterrows():
        feats = build_feature_row(
            r["team_a"], r["team_b"], r["stage"], r["host"], history, before_idx=i,
        )
        rows.append(feats)
        labels.append(_match_result(r["score_a"], r["score_b"]))
    X = pd.DataFrame(rows)[FEATURE_COLUMNS]
    y = pd.Series(labels, name="result")
    return X, y


# ---------------------------------------------------------------------------
# Train / load / predict
# ---------------------------------------------------------------------------

def train_model(verbose: bool = True) -> XGBClassifier:
    """Train the XGBoost classifier and persist it to disk."""
    X, y = _build_training_frame()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y,
    )

    model = XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.08,
        objective="multi:softprob",
        num_class=3,
        eval_metric="mlogloss",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    if verbose:
        preds = model.predict(X_test)
        probas = model.predict_proba(X_test)
        acc = accuracy_score(y_test, preds)
        ll = log_loss(y_test, probas, labels=[0, 1, 2])
        print(f"[outcome_predictor] test accuracy={acc:.3f}  log_loss={ll:.3f}")

    joblib.dump(model, MODEL_PATH)
    return model


def load_or_train() -> XGBClassifier:
    """Load the saved model if present, otherwise train and save it."""
    if MODEL_PATH.exists():
        return joblib.load(MODEL_PATH)
    return train_model()


def predict_match(team_a: str, team_b: str, stage: str = "GROUP", host: str = "USA") -> dict:
    """
    Predict win/draw/loss probabilities for a hypothetical fixture.

    Returns probabilities plus rich context stats (ranks, form, H2H).
    """
    model = load_or_train()
    history = pd.read_csv(HISTORICAL_CSV)
    idx = len(history)

    # Compute feature components individually so we can expose them to the UI.
    a_scored, a_conceded = _recent_form(history, team_a, idx)
    b_scored, b_conceded = _recent_form(history, team_b, idx)
    h2h = _h2h_winrate(history, team_a, team_b, idx)

    feats = build_feature_row(team_a, team_b, stage, host, history)
    X = pd.DataFrame([feats])[FEATURE_COLUMNS]
    probs = model.predict_proba(X)[0]

    labels = ["A_WIN", "DRAW", "B_WIN"]
    predicted = labels[int(np.argmax(probs))]

    # Count head-to-head meetings for context.
    mask = (
        ((history["team_a"] == team_a) & (history["team_b"] == team_b))
        | ((history["team_a"] == team_b) & (history["team_b"] == team_a))
    )
    h2h_meetings = int(mask.sum())

    # WC history: titles, appearances, best finish, and recent form W/D/L
    wc_a = get_team_wc_stats(team_a)
    wc_b = get_team_wc_stats(team_b)

    return {
        "team_a": team_a,
        "team_b": team_b,
        "stage": stage,
        "probabilities": {
            "a_win": float(probs[CLASS_A_WIN]),
            "draw":  float(probs[CLASS_DRAW]),
            "b_win": float(probs[CLASS_B_WIN]),
        },
        "predicted": predicted,
        # Extra context surfaced in the UI
        "stats": {
            "rank_a":          get_fifa_rank(team_a),
            "rank_b":          get_fifa_rank(team_b),
            "form_a_scored":   round(float(a_scored),   2),
            "form_a_conceded": round(float(a_conceded), 2),
            "form_b_scored":   round(float(b_scored),   2),
            "form_b_conceded": round(float(b_conceded), 2),
            "h2h_a_win_rate":  round(float(h2h), 3),
            "h2h_meetings":    h2h_meetings,
            # WC history facts
            "wc_a": wc_a,
            "wc_b": wc_b,
        },
    }


if __name__ == "__main__":
    train_model()
    demo = predict_match("Argentina", "Brazil", stage="SF")
    print(demo)
