"""
Centerpiece: selects the single most weighty note of the week.

Scoring is multi-factor - not just "longest". A reflection-type note with
high cognitive density and emotional intensity beats a long but shallow one.

Source-aware scoring:
- "authored" notes are weighted normally (the user's own voice).
- "saved" notes WITH a description are still strong candidates - the
  description IS the user's voice, even if the content isn't.

- "saved" notes WITHOUT a description are penalized - the content is
  external material, and centerpiece should ground the letter in the
  user's own moments. A long unannotated saved article is not weighty.

Why this matters: this component grounds the entire Narrative in one specific,
real moment. Without source awareness, the letter could open with "the day you
wrote about Murakami's prose" when in fact the user just saved a Murakami quote.
"""

from typing import Optional
import pandas as pd

from models import CenterpieceNote
from utils.nan_to_none import nan_to_none

# Excerpt length for the LLM to quote from.
EXCERPT_CHARS = 220

# Scoring weights - tunable. Sum doesn't need to be 1.
WEIGHTS = {
    "reflection_bonus": 1.5,  # cognitive_type == 'reflection' is preferred
    "intensity": 1.0,  # emotional weight
    "length_normalized": 0.6,  # longer-than-average gets a bump
    "evolution_bonus": 0.5,  # relationship in (evolution, contradiction)
    "confidence": 0.4,  # higher-confidence analyses are more trustworthy
    # Source-type adjustments
    "described_save_bonus": 1.0,  # saved + description: user explained why
    "undescribed_save_penalty": 1.2,  # saved without description: external material
}

# Penalize notes that are too short to be a "centerpiece"
MIN_LENGTH = 100


def select_centerpiece(df: pd.DataFrame) -> Optional[CenterpieceNote]:
    """Pick the highest-scoring note. Returns None if no notes qualify."""
    if df.empty:
        return None

    candidates = df[df["raw_length"] >= MIN_LENGTH].copy()
    if candidates.empty:
        # Fallback: best of what we have
        candidates = df.copy()

    candidates["score"] = candidates.apply(
        _score_row, axis=1, mean_length=df["raw_length"].mean()
    )

    if candidates["score"].max() <= 0:
        return None

    winner = candidates.loc[candidates["score"].idxmax()]

    return CenterpieceNote(
        note_id=winner["note_id"],
        title=winner.get("title"),
        created_at=winner["created_at"],
        excerpt=_build_excerpt(winner),
        why_chosen=_explain_choice(winner),
        # Pass source signals through so the prompt can frame the centerpiece
        # correctly. Defaults to "authored" if the column is missing for any
        # reason (legacy data, partial migration).
        source_type=nan_to_none(winner.get("source_type")) or "authored",
        description=nan_to_none(winner.get("description")) or None,
    )


# ----- helpers -----


def _score_row(row: pd.Series, mean_length: float) -> float:
    score = 0.0

    if row.get("cognitive_type") == "reflection":
        score += WEIGHTS["reflection_bonus"]

    intensity = row.get("emotion_intensity")
    if intensity is not None and not pd.isna(intensity):
        score += float(intensity) * WEIGHTS["intensity"]

    length = row.get("raw_length", 0)
    if mean_length > 0:
        length_norm = min(length / mean_length, 3.0)  # cap at 3x mean
        score += length_norm * WEIGHTS["length_normalized"] / 3.0

    if row.get("relationship") in ("evolution", "contradiction"):
        score += WEIGHTS["evolution_bonus"]

    confidence = row.get("confidence")
    if confidence is not None and not pd.isna(confidence):
        score += float(confidence) * WEIGHTS["confidence"]

    # Source-type adjusments. Authored notes are neutral here - the other
    # signals already favor them naturally (reflection / emotion/ etc.).
    source_type = row.get("source_type") or "authored"
    has_description = bool(row.get("has_description"))

    if source_type == "saved":
        if has_description:
            # The user explained why they saved this - that IS user voice.
            score += WEIGHTS["described_save_bonus"]
        else:
            # External material with no user annotation. Should rarely
            # win the centerpiece slot.
            score -= WEIGHTS["undescribed_save_penalty"]

    return score


def _build_excerpt(row: pd.Series) -> str:
    source = row.get("summary") or row.get("raw_content") or ""
    return (source or "")[:EXCERPT_CHARS].strip()


def _explain_choice(row: pd.Series) -> str:
    """Human-readable reason for why this note was chosen."""
    reasons = []

    source_type = row.get("source_type") or "authored"
    has_description = bool(row.get("has_description"))

    # Lead with source framing when it materially changes interpretation.
    if source_type == "saved" and has_description:
        reasons.append("a saved piece with the user's own note on why")
    elif source_type == "saved":
        reasons.append("a saved piece the user preserved this week")

    if row.get("cognitive_type") == "reflection":
        reasons.append("a reflective note")
    if row.get("relationship") == "evolution":
        reasons.append("captures an evolving stance")
    elif row.get("relationship") == "contradiction":
        reasons.append("marks a shift in thinking")

    intensity = row.get("emotion_intensity")
    if intensity is not None and not pd.isna(intensity) and intensity >= 0.6:
        # Only frame as "emotionally weighty" for authored notes — for saved
        # notes the emotion would describe the saved material, not the user.
        if source_type == "authored":
            reasons.append("emotionally weighty")

    if row.get("raw_length", 0) >= 500:
        reasons.append("the longest entry of the week")

    if not reasons:
        reasons.append("the most substantial entry of the week")

    return ", ".join(reasons)
