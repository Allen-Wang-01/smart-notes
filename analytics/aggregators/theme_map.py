"""
Theme Map: shows the user's attention distribution this week.

Compares against the previous week's themes to surface notable changes
(e.g. "first time technical learning entered top 3").
"""

from typing import Optional
import pandas as pd
from models import ThemeMap, ThemeSlice
from utils.nan_to_none import nan_to_none

# Themes appearing fewer than this many times are not shown in the map.
MIN_THEME_OCCURRENCES = 1

# How many themes to show, max.
MAX_THEMES_DISPLAYED = 6


def build_theme_map(
    df: pd.DataFrame, previous_report: Optional[dict]
) -> Optional[ThemeMap]:
    """
    Build the Theme Map component.

    Returns None if there are no themes at all this week.
    """
    if df.empty:
        return None

    # Explode the themes list so each (note, theme) pair becomes one row
    exploded = df[["note_id", "themes", "emotion_intensity", "relationship"]].explode(
        "themes"
    )
    exploded = exploded.dropna(subset=["themes"])

    if exploded.empty:
        return None

    # Aggregate pre-theme stats
    grouped = (
        exploded.groupby("themes")
        .agg(
            note_count=("note_id", "count"),
            note_ids=("note_id", lambda s: list(s.unique())),
            avg_emotion_intensity=("emotion_intensity", "mean"),
            # Pick the most common relationship per theme
            dominant_relationship=("relationship", lambda s: _mode_or_none(s)),
        )
        .reset_index()
    )

    grouped = grouped[grouped["note_count"] >= MIN_THEME_OCCURRENCES]
    grouped = grouped.sort_values("note_count", ascending=False).head(
        MAX_THEMES_DISPLAYED
    )

    if grouped.empty:
        return None

    slices = [
        ThemeSlice(
            theme=row["themes"],
            note_count=int(row["note_count"]),
            note_ids=row["note_ids"],
            avg_emotion_intensity=_round(row["avg_emotion_intensity"]),
            # _nan_to_none guards against pandas converting our None
            # sentinel from _mode_or_none into NaN inside the agg result.
            # Pydantic's Optional[str] accepts None but rejects float('nan').
            dominant_relationship=nan_to_none(row["dominant_relationship"]),
        )
        for _, row in grouped.iterrows()
    ]

    notable_change = _detect_notable_change(slices, previous_report)

    return ThemeMap(
        total_notes=len(df),
        themes=slices,
        notable_change=notable_change,
    )


# ----- helpers -----
def _mode_or_none(series: pd.Series) -> Optional[str]:
    """Return the most common non-null value, or None."""
    cleaned = series.dropna()
    if cleaned.empty:
        return None
    mode = cleaned.mode()
    return mode.iloc[0] if not mode.empty else None


def _round(value) -> Optional[float]:
    if value is None or pd.isna(value):
        return None
    return round(float(value), 2)


def _detect_notable_change(
    current_slices: list[ThemeSlice], previous_report: Optional[dict]
) -> Optional[str]:
    """
    Compare to last week's top themes and surface a notable change, if any.

    Examples of notable changes:
    - A theme appears in top 3 for the first time
    - A theme that was in top 3 last week disappeared entirely
    """

    if not previous_report or not current_slices:
        return None
    previous_components = previous_report.get("components", {})
    previous_theme_map = previous_components.get("theme_map") or {}
    previous_themes = previous_theme_map.get("themes") or []
    previous_top = [t.get("theme") for t in previous_themes[:3] if t.get("theme")]
    current_top = [s.theme for s in current_slices[:3]]

    if not previous_top:
        return None

    # New entries to top 3
    new_in_top = [t for t in current_top if t not in previous_top]
    if new_in_top:
        return (
            f"'{new_in_top[0]}' entered your top focus this week — new since last week."
        )

    # Disappeared from top 3
    dropped = [t for t in previous_top if t not in current_top]
    if dropped:
        return f"'{dropped[0]}' was a focus last week but didn't return this week."

    return None
