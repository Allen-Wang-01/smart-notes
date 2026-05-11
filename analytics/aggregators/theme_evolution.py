"""
Theme Evolution: traces how the user's emotional stance on a theme
evolved through the week.

Selection logic: only themes with at least 3 mentions AND a non-trivial
emotional or relational change qualify as having "evolved".

Source filtering:
A "theme evolution" describes how the USER'S stance shifted. Notes the user
saved without describing why express the saved content's tone, not the user's
own emotional movement. They contribute themes (the topic IS what the user
chose to engage with) but they do NOT contribute emotion/relationship
trajectory points. Saved notes WITH a description are kept - the description
is the user's voice and grounds the trajectory in a real user moment.
"""

from collections import Counter
import pandas as pd

from models import ThemeEvolution, EmotionPoint

# A theme must appear in at least this many notes to be considered for evolution.
MIN_NOTES_FOR_EVOLUTION = 3

# Cap on how many themes get an evolution entry (most prominent first).
MAX_EVOLUTIONS = 2

# Excerpt length when grounding the LLM in actual user language.
EXCERPT_CHARS = 140


def build_theme_evolutions(df: pd.DataFrame) -> list[ThemeEvolution]:
    """
    Build evolution entries for the most prominent themes that show
    actual change (emotion shift, relationship variety).
    """
    if df.empty:
        return []

    # Find themes with enough notes to potentially show evolution.
    # Theme presence counts ALL notes (saved or authored) - what the user
    # engaged with is signal regardless of source.
    exploded = df.explode("themes").dropna(subset=["themes"])
    if exploded.empty:
        return []

    theme_counts = exploded["themes"].value_counts()
    qualifying_themes = theme_counts[
        theme_counts >= MIN_NOTES_FOR_EVOLUTION
    ].index.tolist()

    evolutions: list[ThemeEvolution] = []

    for theme in qualifying_themes:
        theme_notes = exploded[exploded["themes"] == theme].sort_values("created_at")

        # Filter trajectory-eligible notes: emotion / relationship signals
        # are only trusted when they come from the user's own voice.
        trajectory_notes = _filter_user_voice(theme_notes)

        # Need at least 2 user-voice points for a "trajectory".
        # If the theme is dominated by undescribed saves, skip it - there's
        # no evolution to narrate, only topic presence.
        if len(trajectory_notes) < 2:
            continue
        if not _has_meaningful_change(trajectory_notes):
            continue

        trajectory = _build_trajectory(trajectory_notes)
        relationship_summary = _summarize_relationships(trajectory_notes)

        evolutions.append(
            ThemeEvolution(
                theme=theme,
                trajectory=trajectory,
                relationship_summary=relationship_summary,
            )
        )

        if len(evolutions) >= MAX_EVOLUTIONS:
            break

    return evolutions


# ----- helpers -----


def _filter_user_voice(theme_notes: pd.DataFrame) -> pd.DataFrame:
    """
    Keep only notes whose emotion / relationship genuinely reflect the user:
    - authored notes (always user voice)
    - saved notes WITH a description (the description is user voice)

    Drop saved notes without a description — their analysis describes the
    saved material, not the user's stance.
    """
    if "source_type" not in theme_notes.columns:
        # Defensive: legacy data without source_type - treat as authored.
        return theme_notes

    is_authored = theme_notes["source_type"].fillna("authored") == "authored"
    is_described_save = (theme_notes["source_type"] == "saved") & theme_notes[
        "has_description"
    ].fillna(False)
    return theme_notes[is_authored | is_described_save]


def _has_meaningful_change(theme_notes: pd.DataFrame) -> bool:
    """
    A theme has 'meaningful change' if either:
    - Its emotion changed during the week, OR
    - It contains at least one 'evolution' or 'contradiction' relationship
    """
    emotions = theme_notes["emotion"].dropna().unique()
    if len(emotions) >= 2:
        return True

    relationships = theme_notes["relationship"].dropna().unique()
    if any(r in ("evolution", "contradiction") for r in relationships):
        return True

    # Even with same emotion, intensity drift counts
    intensities = theme_notes["emotion_intensity"].dropna()
    if len(intensities) >= 2 and (intensities.max() - intensities.min()) >= 0.3:
        return True

    return False


def _build_trajectory(theme_notes: pd.DataFrame) -> list[EmotionPoint]:
    """Build the time-ordered list of emotion points for this theme."""
    points = []
    for _, row in theme_notes.iterrows():
        # For saved+description notes, the description IS the user voice
        # and is more grounded than the saved content excerpt.
        # For authored notes, summary > raw_content as usual.
        source_type = row.get("source_type") or "authored"
        has_description = bool(row.get("has_description"))
        if source_type == "saved" and has_description:
            excerpt_source = row.get("description") or ""
        else:
            excerpt_source = row.get("summary") or row.get("raw_content") or ""

        excerpt = (excerpt_source or "")[:EXCERPT_CHARS].strip()
        emotion = row.get("emotion")
        # Convert pandas NaN / None to a placeholder; emotion is required by the model
        if emotion is None or pd.isna(emotion):
            emotion = "—"

        points.append(
            EmotionPoint(
                date=row["created_at"],
                emotion=emotion,
                intensity=_round(row.get("emotion_intensity")),
                note_excerpt=excerpt,
            )
        )
    return points


def _summarize_relationships(theme_notes: pd.DataFrame) -> dict:
    """Count occurrences of each relationship type."""
    relationships = theme_notes["relationship"].dropna()
    return dict(Counter(relationships))


def _round(value) -> float | None:
    if value is None or pd.isna(value):
        return None
    return round(float(value), 2)
