"""
Extracts behavioural time patterns from note createdAt timestamps.

These patterns reveal habits the user themselves may not be aware of,
which is what makes them compelling in a personal report:
    - "You tend to write late at night on your most stressed days"
    - "Wednesday was your most active journaling day this week"
    - "Your energy is consistently lower in notes written after 9pm"

Patterns computed
-----------------
writing_session_distribution  — morning / afternoon / evening / night breakdown
most_active_day               — weekday with the most notes
most_active_hour_block        — the time-of-day block with most notes
late_night_ratio              — share of notes written between 22:00–04:00
night_stress_correlation      — whether late-night notes skew more stressed/low-energy
busiest_day_detail            — date + count of the single busiest calendar day
"""

from collections import Counter, defaultdict
from datetime import datetime
from typing import Any

# Hour boundaries for session classification (24h clock)
_MORNING = range(5, 12)  # 05:00 - 11:59
_AFTERNOON = range(12, 18)  # 12:00 – 17:59
_EVENING = range(18, 22)  # 18:00 – 21:59
# Night = everything else: 22:00–04:59

_WEEKDAY_NAMES = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


def _to_datetime(note: dict[str, Any]) -> datetime | None:
    """
    Parse note['createdAt'] into a datetime object
    Handles both native datetime and ISO string formats
    """

    created_at = note.get("createdAt")
    if created_at is None:
        return None
    if isinstance(created_at, datetime):
        return created_at
    try:
        return datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
    except ValueError:
        return None


def _classify_session(hour: int) -> str:
    """
    Return the time-of-day session label for a given hour (0-23)
    """

    if hour in _MORNING:
        return "morning"
    if hour in _AFTERNOON:
        return "afternoon"
    if hour in _EVENING:
        return "evening"
    return "night"


def _is_late_night(hour: int) -> bool:
    """Return True for hours considered late night: 22:00–04:59."""
    return hour >= 22 or hour < 5


def analyze_time_patterns(notes: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Compute time-based behavioural patterns from a list of notes

    Args:
        notes: All notes for the current reporting period

    Returns:
        A dict with all pattern fields. Fields that cannot ba computed
        (e.g. due to missing timestamps) are set to None so snapshot
        rendering can handle them gracefully
    """

    # Parse timestamps - skip notes with unparseable dates
    timed: list[tuple[datetime, dict[str, Any]]] = []
    for note in notes:
        dt = _to_datetime(note)
        if dt is not None:
            timed.append((dt, note))

    if not timed:
        return _empty_patterns()

    # ── Session distribution ──────────────────────────────────────────────────
    session_counts: Counter = Counter()
    for dt, _ in timed:
        session_counts[_classify_session(dt.hour)] += 1

    total = len(timed)
    session_distribution = {
        session: round(count / total, 4) for session, count in session_counts.items()
    }

    # ── Most active time block ────────────────────────────────────────────────
    most_active_session = (
        session_counts.most_common(1)[0][0] if session_counts else None
    )

    # ── Most active weekday ───────────────────────────────────────────────────
    weekday_counts: Counter = Counter()
    for dt, _ in timed:
        weekday_counts[dt.weekday()] += 1  # 0 = Monday

    most_active_weekday_idx = (
        weekday_counts.most_common(1)[0][0] if weekday_counts else None
    )
    most_active_day = (
        _WEEKDAY_NAMES[most_active_weekday_idx]
        if most_active_weekday_idx is not None
        else None
    )

    # ── Late night ratio ──────────────────────────────────────────────────────
    late_night_count = sum(1 for dt, _ in timed if _is_late_night(dt.hour))
    late_night_ratio = round(late_night_count / total, 4)

    # ── Night stress correlation ──────────────────────────────────────────────
    # Compare avg emotionIntensity and avgEnergy between late-night vs other notes.
    # Only computed if there are at least 2 late-night notes to compare against.
    night_stress_correlation = _compute_night_correlation(timed)

    # ── Busiest single calendar day ───────────────────────────────────────────
    day_counts: Counter = Counter()
    for dt, _ in timed:
        day_counts[dt.date().isoformat()] += 1

    if day_counts:
        busiest_date, busiest_count = day_counts.most_common(1)[0]
    else:
        busiest_date, busiest_count = None, None

    # ── Average notes per active day ─────────────────────────────────────────
    active_days = len(day_counts)
    avg_notes_per_day = round(total / active_days, 2) if active_days > 0 else None

    return {
        "total_notes_analysed": total,
        "active_days": active_days,
        "avg_notes_per_active_day": avg_notes_per_day,
        "session_distribution": session_distribution,
        "most_active_session": most_active_session,
        "most_active_day": most_active_day,
        "late_night_ratio": late_night_ratio,
        "night_stress_correlation": night_stress_correlation,
        "busiest_date": busiest_date,
        "busiest_date_note_count": busiest_count,
    }


def _compute_night_correlation(
    timed: list[tuple[datetime, dict[str, Any]]],
) -> dict[str, Any] | None:
    """
    Check whether late-night notes show higher stress or lower energy
    compared to non-late-night notes.

    Returns a dict with avg intensity and energy for both groups,
    plus a human-readable observation string.
    Return None if there are fewer than 2 notes in either group
    """
    late: list[dict[str, Any]] = []
    other: list[dict[str, Any]] = []

    for dt, note in timed:
        if _is_late_night(dt.hour):
            late.append(note)
        else:
            other.append(note)
    # Need at least 2 in each group for a meaningful comparison
    if len(late) < 2 or len(other) < 2:
        return None

    def _avg(notes: list[dict[str, Any]], field: str) -> float | None:
        vals = [
            n["analysis"][field]
            for n in notes
            if n.get("analysis") and n["analysis"].get(field) is not None
        ]

        return round(sum(vals) / len(vals), 4) if vals else None

    late_intensity = _avg(late, "emotionIntensity")
    other_intensity = _avg(other, "emotionIntensity")
    late_energy = _avg(late, "energyLevel")
    other_energy = _avg(other, "energyLevel")

    # Build a plain-English observation for the LLM
    observations: list[str] = []
    if late_intensity is not None and other_intensity is not None:
        if late_intensity > other_intensity + 0.1:
            observations.append("late-night notes are more emotionally intense")
        elif late_intensity < other_intensity - 0.1:
            observations.append("late-night notes are emotionally calmer")

        if late_energy is not None and other_energy is not None:
            if late_energy < other_energy - 0.1:
                observations.append("energy is noticeably lower in late-night notes")
            elif late_energy > other_energy + 0.1:
                observations.append("energy is surprisingly higher in late-night notes")

        observation = (
            "; ".join(observations).capitalize() + "."
            if observations
            else "No significant difference between late-night and daytime notes."
        )

        return {
            "late_night_note_count": len(late),
            "other_note_count": len(other),
            "late_night_avg_intensity": late_intensity,
            "other_avg_intensity": other_intensity,
            "late_night_avg_energy": late_energy,
            "other_avg_energy": other_energy,
            "observation": observation,
        }


def _empty_patterns() -> dict[str, Any]:
    """Return a patterns dict with all fields set to None."""
    return {
        "total_notes_analysed": 0,
        "active_days": 0,
        "avg_notes_per_active_day": None,
        "session_distribution": {},
        "most_active_session": None,
        "most_active_day": None,
        "late_night_ratio": None,
        "night_stress_correlation": None,
        "busiest_date": None,
        "busiest_date_note_count": None,
    }
