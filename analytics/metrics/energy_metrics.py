"""
Calculates energy, focus, and burnout-related metrics from note documents
"""

from typing import Any


def get_avg_energy(notes: list[dict[str, Any]]) -> float:
    """
    Compute the average energyLevel across all notes
    Returns None when no valid values exist (e.g. empty note list)
    so callers can distinguish "no data" from "energy was zero"
    """
    values = [
        n["analysis"]["energyLevel"]
        for n in notes
        if n.get("analysis") and n["analysis"].get("energyLevel") is not None
    ]

    if not values:
        return None
    return round(sum(values) / len(values), 4)


def get_avg_focus(notes: list[dict[str, Any]]) -> float:
    """
    Compute the average focusLevel across all notes
    Returns None when no valid values exist
    """

    values = [
        n["analysis"]["focusLevel"]
        for n in notes
        if n.get("analysis") and n["analysis"].get("focusLevel") is not None
    ]

    if not values:
        return None
    return round(sum(values) / len(values), 4)


def get_low_energy_days(daily_energy: dict[str, float], threshold: float = 0.4) -> int:
    """
    Count the number of days where average energy is below `threshold`

    Args:
        daily_energy: Output of time_series.build_daily_energy(), mapping
        date string -> avg energy
    threshold: Energy value below which a day is considered 'low energy'

    Returns:
    Integer count of low-energy days
    """

    return sum(1 for v in daily_energy.values() if v < threshold)


def detect_burnout_risk(
    stress_ratio: float,
    avg_energy: float | None,
    low_energy_days: int,
    stress_threshold: float = 0.4,
    energy_threshold: float = 0.45,
    low_energy_day_threshold: int = 3,
) -> bool:
    """
    Heuristic burnout detection.

    A user is considered at burnout risk when ALL of the following are true:
    - stress ratio exceeds stress_threshold
    - average energy is below energy_threshold
    - number of low-energy days exceeds low_energy_day_threshold
    Thresholds are tunable via parameters

    Returns False when avg_energy is None (insufficient data)
    """

    if avg_energy is None:
        return False

    return (
        stress_ratio >= stress_threshold
        and avg_energy <= energy_threshold
        and low_energy_days >= low_energy_day_threshold
    )
