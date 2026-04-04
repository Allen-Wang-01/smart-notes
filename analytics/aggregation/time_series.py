"""
Builds daily time-series data from a list of note documents.
Each note must have a 'createdAt' field (datetime) and an 'analysis' sub-dict
"""

from collections import defaultdict
from typing import Any
from datetime import datetime, timezone


def _date_key(note: dict[str, Any]) -> str | None:
    """
    Extract a YYYY-MM-DD string from note['createdAt']
    Handles both datetime objects and ISO strings
    """

    created_at = note.get("createdAt")
    if created_at is None:
        return None
    if isinstance(created_at, datetime):
        return created_at.date().isoformat()
    # Handle ISO string format
    try:
        dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
        return dt.date().isoformat()
    except ValueError:
        return None


def build_daily_energy(notes: list[dict[str, Any]]) -> dict[str, float]:
    """
    Compute average energyLevel per calendar day.
    Returns:
        Dict mapping 'YYYY-MM-DD' -> avg energy (rounded to 4 decimal places)
    """
    daily: dict[str, list[float]] = defaultdict(list)
    for note in notes:
        day = _date_key(note)
        if day and note.get("analysis"):
            energy = note["analysis"].get("energyLevel")
            if energy is not None:
                daily[day].append(energy)

    return {day: round(sum(vals) / len(vals), 4) for day, vals in sorted(daily.items())}


def build_daily_focus(notes: list[dict[str, Any]]) -> dict[str, float]:
    """
    Compute average focusLevel per calendar day.
    Returns:
        Dict mapping 'YYYY-MM-DD' -> avg focus (round to 4 decimal places)
    """
    daily: dict[str, list[float]] = defaultdict(list)

    for note in notes:
        day = _date_key(note)
        if day and note.get("analysis"):
            focus = note["analysis"].get("focusLevel")
            if focus is not None:
                daily[day].append(focus)
    return {day: round(sum(vals) / len(vals), 4) for day, vals in sorted(daily.items())}


def build_daily_note_count(notes: list[dict[str, Any]]) -> dict[str, int]:
    """

    Count the number of notes created per calenday day.

    Returns:
        Dict mapping 'YYYY-MM-DD' -> note count
    """
    daily: dict[str, int] = defaultdict(int)
    for note in notes:
        day = _date_key(note)
        if day:
            daily[day] += 1
    return dict(sorted(daily.items()))


def build_daily_emotion_distribution(
    notes: list[dict[str, Any]],
) -> dict[str, dict[str, float]]:
    """
    Compute the emotion distribution (ratio per emotion) per calendar day

    Returns:
        Dict mapping 'YYYY-MM-DD' -> {emotion: ratio}
    """
    from collections import Counter

    daily_emotions: dict[str, list[str]] = defaultdict(list)
    for note in notes:
        day = _date_key(note)
        if day and note.get("analysis"):
            emotion = note["analysis"].get("emotionPromary")
            if emotion:
                daily_emotions[day].append(emotion)
    result: dict[str, dict[str, float]] = {}
    for day, emotions in sorted(daily_emotions.items()):
        counts = Counter(emotions)
        total = len(emotions)
        result[day] = {e: round(c / total, 4) for e, c in counts.most_common()}
    return result
