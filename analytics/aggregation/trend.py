"""
Compute period-over-period trend by diffing the current period's computed
metrics against the *already-generated* previous report JSON.

Design rationale
----------------
Re-computing metrics from raw previous-period notes would be redundant —
the previous report already contains all the aggregated values we need.
Instead we extract specific fields from previous_report['summary'] and
previous_report['insights'] and subtract them from their current equivalents.

If previous_report is None or missing expected keys, every affected field
is set to None with an 'available: False' flag so callers / LLMs know trend
data is simply absent rather than zero.

Trend fields produced
---------------------
energy_change           float | None   avg_energy delta (current - previous)
focus_change            float | None   avg_focus delta
note_count_change       int   | None   note_count delta
dominant_emotion_changed bool  | None   whether dominant emotion shifted
stress_ratio_change     float | None   stress_ratio delta (insights)
volatility_change       float | None   emotional_volatility delta (insights)
available               bool           False when previous_report is absent
"""

from typing import Any


def _safe_diff(current: float | None, previous: float | None) -> float | None:
    """
    Return current - previous rounded to 4 decimal places.
    Returns None if either value is missing
    """

    if current is None or previous is None:
        return None
    return round(current - previous, 4)


def _extract(report: dict[str, Any], section: str, key: str) -> float | None:
    """
    Safely pull a numeric value from report[section][key]
    Returns None if the path does not exist or the value is not numeric
    """
    try:
        value = report[section][key]
        return float(value) if value is not None else None
    except (KeyError, TypeError, ValueError):
        return None


def compute_trend(
    current_summary: dict[str, Any],
    current_insights: dict[str, Any],
    previous_report: dict[str, Any] | None,
) -> dict[str, Any]:
    """
    Compute trend metrics by comparing current period values against the
    previous period's report JSON

    Args:
        current_summary: The 'summary' block of the report being built now
        current_insights: The 'insights' block of the report being built now
        previous_report: The full report JSON dict from the prior period,
        or None if no previous report exists

    Returns:
        A trend dict. When previous_report is None, all numeric fields are
        None and 'available' is False so downstream consumers (including LLMs)
        can handle the absence gracefully.
    """

    # ── No previous data: return an explicit "unavailable" trend ─────────────
    if not previous_report:
        return {
            "available": False,
            "reason": "No previous period report found.",
            "energy_change": None,
            "focus_change": None,
            "note_count_change": None,
            "dominant_emotion_changed": None,
            "stress_ratio_change": None,
            "volatility_change": None,
        }

    # ── Float deltas from summary ─────────────────────────────────────────────
    energy_change = _safe_diff(
        current_summary.get("avg_energy"),
        _extract(previous_report, "summary", "avg_energy"),
    )

    focus_change = _safe_diff(
        current_summary.get("avg_focus"),
        _extract(previous_report, "summary", "avg_focus"),
    )

    # ── Note count delta (integer) ────────────────────────────────────────────
    curr_count = current_summary.get("note_count")
    prev_count_raw = _extract(previous_report, "summary", "note_count")
    note_count_change: int | None = None
    if curr_count is not None and prev_count_raw is not None:
        note_count_change = int(curr_count) - int(prev_count_raw)

    # ── Dominant emotion change (boolean) ─────────────────────────────────────
    curr_dominant = current_summary.get("dominant_emotion")
    try:
        prev_dominant = previous_report["summary"]["dominant_emotion"]
    except (KeyError, TypeError):
        prev_dominant = None

    dominant_emotion_changed: bool | None = None
    if curr_dominant is not None and prev_dominant is not None:
        dominant_emotion_changed = curr_dominant != prev_dominant

    # ── Float deltas from insights ────────────────────────────────────────────
    stress_ratio_change = _safe_diff(
        current_insights.get("stress_ratio"),
        _extract(previous_report, "insights", "stress_ratio"),
    )

    volatility_change = _safe_diff(
        current_insights.get("emotional_volatility"),
        _extract(previous_report, "insights", "emotional_volatility"),
    )

    return {
        "available": True,
        "energy_change": energy_change,
        "focus_change": focus_change,
        "note_count_change": note_count_change,
        "dominant_emotion_changed": dominant_emotion_changed,
        "stress_ratio_change": stress_ratio_change,
        "volatility_change": volatility_change,
    }
