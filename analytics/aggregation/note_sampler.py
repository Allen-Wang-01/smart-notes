"""
Select a small set of representative notes from the current period to be
embedded in the LLM snapshot. The goal is to ground the emotional report in
concrete moments rather than pure statistics.

Selection strategy
------------------
We pick up to 4 notes across 4 roles.  A single note can only fill one role
(deduplication by _id).  Roles in priority order:

  1. peak_intensity  — highest emotionIntensity note (most emotionally charged)
  2. low_energy      — lowest energyLevel note (hardest day)
  3. positive_moment — joy/calm note with highest intensity (highlight / bright spot)
  4. turning_point   — the note where the largest single-day energy shift occurred
                       relative to the previous day's average

Each selected note is annotated with:
  - sample_role     : why it was selected
  - raw_excerpt     : first RAW_EXCERPT_CHARS characters of rawContent
                      This is the user's own unedited language, which makes
                      the generated report feel personal and specific.
                      rawContent is always based on what the user originally
                      wrote, so it never goes stale regardless of content edits.

Only notes that have a non-null summary and analysis are considered candidates.
"""

from datetime import datetime
from typing import Any

# Maximum characters of rawContent to include as the user-voice excerpt.
# Long enough to capture a genuine thought; short enough to stay token-efficient.
RAW_EXCERPT_CHARS = 150

# Emotions treated as positive for the positive_moment role
_POSITIVE_EMOTIONS = {"joy", "calm"}


def _date_key(note: dict[str, Any]) -> str | None:
    """
    Return 'YYYY-MM-DD' from note['createdAt'], or None
    """
    created_at = note.get("createdAt")
    if created_at is None:
        return None
    if isinstance(created_at, datetime):
        return created_at.date().isoformat()
    try:
        dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
        return dt.date().isoformat()
    except ValueError:
        return None


def _sort_key_date(note: dict[str, Any]) -> str:
    """
    Sort helper: returns date string, defaulting to empty string
    """
    return _date_key(note) or ""


def _eligible(note: dict[str, Any]) -> bool:
    """
    A note is eligible for selection only if it has analysis data
    and a non-empty summary to display
    """

    has_summary = bool((note.get("summary") or "").strip())
    has_analysis = bool(note.get("analysis"))
    return has_summary and has_analysis


def _extract_raw_excerpt(note: dict[str, Any]) -> str:
    """
    Extract the first RAW_EXCEPT_CHARS characters of rawContent

    rawContent is the user's original unedited text - the most authentic
    voice we have. We truncate with an ellipsis to signal to the LLM
    that this is a partial quote, not the full note.

    Returns an empty string if rawContent is absent
    """

    raw = (note.get("rawContent") or "").strip()
    if not raw:
        return ""
    if len(raw) < RAW_EXCERPT_CHARS:
        return raw

    # Truncate at the last space within the limit to avoid cutting mid-word
    truncated = raw[:RAW_EXCERPT_CHARS]
    last_space = truncated.rfind(" ")
    if last_space > RAW_EXCERPT_CHARS * 0.7:  # only snap to word if not too short
        truncated = truncated[:last_space]
    return truncated + "..."


def _find_peak_intensity(candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    """
    Return the note with the highest emotionIntensity
    """
    eligible = [
        n for n in candidates if n["analysis"].get("emotionIntensity") is not None
    ]
    if not eligible:
        return None
    return max(eligible, key=lambda n: n["analysis"]["emotionIntensity"])


def _find_low_energy(candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    """
    Return the note with the lowest energyLevel
    """

    eligible = [n for n in candidates if n["analysis"].get("energyLevel") is not None]
    if not eligible:
        return None
    return min(eligible, key=lambda n: n["analysis"]["energyLevel"])


def _find_positive_moment(candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    """
    Return the joy/calm note with the highest emotionIntensity.
    If no positive notes exist, return None
    """
    positive = [
        n
        for n in candidates
        if n["analysis"].get("emotionPrimary") in _POSITIVE_EMOTIONS
        and n["analysis"].get("emotionIntensity") is not None
    ]

    if not positive:
        return None
    return max(positive, key=lambda n: n["analysis"]["emotionIntensity"])


def _find_turning_point(candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    """
    Find the note that represents the largest energyshift from the previous day
    Algorithm:
        1. Group notes by date and compute the average eneryLevel per day
        2. Find the day with the maximum absolute change vs the preceding day
        3. Return the note on that day with the energy value closest to that day's average
    """

    from collections import defaultdict

    daily: dict[str, list[float]] = defaultdict(list)
    daily_notes: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for note in candidates:
        day = _date_key(note)
        energy = note["analysis"].get("energyLevel")
        if day and energy is not None:
            daily[day].append(energy)
            daily_notes[day].append(note)

    if len(daily) < 2:
        return None

    sorted_days = sorted(daily.keys())
    daily_avg = {day: sum(vals) / len(vals) for day, vals in daily.items()}

    # Find the day with the largest energy delta from the previous day
    max_delta = 0.0
    turning_day: str | None = None
    for i in range(1, len(sorted_days)):
        prev_day = sorted_days[i - 1]
        curr_day = sorted_days[i]
        delta = abs(daily_avg[curr_day] - daily_avg[prev_day])
        if delta > max_delta:
            max_delta = delta
            turning_day = curr_day

    if turning_day is None or turning_day not in daily_notes:
        return None

    # Among notes on turning_day, return the one closest to that day's average
    day_avg = daily_avg[turning_day]
    return min(
        daily_notes[turning_day],
        key=lambda n: abs((n["analysis"].get("energyLevel") or 0) - day_avg),
    )


def sample_notes(notes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Select up to 4 representative notes from the period

    Each returned note is a shallow copy of the original dict, annotated with:
      - sample_role  (str)  : why this note was selected
      - raw_excerpt  (str)  : first ~150 chars of rawContent (user's own words)

    Args:
        notes: All notes for the current reporting period.

    Returns:
        A deduplicated, chronologically sorted list of up to 4 annotated note dicts.
    """

    candidates = [n for n in notes if _eligible(n)]
    if not candidates:
        return []

    selected: list[dict[str, Any]] = []
    seen_ids: set = set()

    def _add(note: dict[str, Any] | None, role: str) -> None:
        if note is None:
            return
        note_id = str(note.get("_id", id(note)))
        if note_id in seen_ids:
            return
        seen_ids.add(note_id)
        selected.append(
            {**note, "sample_role": role, "raw_excerpt": _extract_raw_excerpt(note)}
        )

    _add(_find_peak_intensity(candidates), "peak_intensity")
    _add(_find_low_energy(candidates), "low_energy")
    _add(_find_positive_moment(candidates), "positive_moment")
    _add(_find_turning_point(candidates), "turning_point")

    # Sort chronologically so the snapshot reads as a narrative timeline
    selected.sort(key=_sort_key_date)
    return selected
