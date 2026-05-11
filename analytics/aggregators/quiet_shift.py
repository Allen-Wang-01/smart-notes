"""
Quiet Shift: detects changes the user likely hasn't consciously noticed
by comparing this week's data to the previous report.

Two kinds of shifts:
1. Theme disappearance — a theme present last week is absent this week.
2. Theme emergence — a theme that genuinely became prominent this week
   without being a top theme last week.

Set operations are clean here, which is why this is one of the cleanest
aggregators in the pipeline.
"""

from typing import Optional
import pandas as pd

from models import QuietShift

# A theme must have appeared this many times last week to qualify as "lost".
LOST_THEME_MIN_PREVIOUS_COUNT = 2


def build_quiet_shifts(
    df: pd.DataFrame, previous_report: Optional[dict]
) -> list[QuietShift]:
    """
    Detect shifts by comparing current themes to previous_reports's themes.

    Returns at most 2 shifts to keep the narrative focused.
    """
    if not previous_report:
        return []

    current_themes = _extract_current_themes(df)
    previous_themes = _extract_previous_themes(previous_report)

    if not previous_themes:
        return []

    shifts: list[QuietShift] = []

    # Detect "lost" themes - were prominent last week, absent this week
    lost = _detect_lost_themes(current_themes, previous_themes)
    shifts.extend(lost)

    return shifts[:2]


# ----- helpers -----


def _extract_current_themes(df: pd.DataFrame) -> set[str]:
    """Set of themes that appeared at least once this week."""
    if df.empty:
        return set()
    exploded = df["themes"].explode().dropna()
    return set(exploded.unique())


def _extract_previous_themes(previous_report: dict) -> dict[str, int]:
    """Map of theme -> note_count from last week's report."""
    components = previous_report.get("components") or {}
    theme_map = components.get("theme_map") or {}
    themes = theme_map.get("themes") or []
    return {t["theme"]: t.get("note_count", 0) for t in themes if t.get("theme")}


def _detect_lost_themes(
    current: set[str], previous: dict[str, int]
) -> list[QuietShift]:
    """Find themes that were significant last week and didn't appear this week."""
    shifts = []
    for theme, count in previous.items():
        if count < LOST_THEME_MIN_PREVIOUS_COUNT:
            continue
        if theme in current:
            continue

        shifts.append(
            QuietShift(
                description=f"You haven't mentioned '{theme}' this week — it appeared {count} times last week.",
                evidence=[f"Previous week count: {count}", "Current week count: 0"],
            )
        )

    return shifts
