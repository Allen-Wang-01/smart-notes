"""
Orchestrates all metric modules and assembles the final JSON payload
to be sent to an LLM for emotional report generation

Design note on data consistency
--------------------------------
emotion analysis (emotionPrimary, energyLevel, etc.) is always derived from
rawContent, which is immutable — users can only edit the LLM-polished content
field.  Therefore analysis data never goes stale and no stale-detection logic
is needed here.
"""

from datetime import date
from typing import Any
from .zero_notes_snapshot import build_zero_notes_snapshot
from .validator import sanitize_notes

from metrics.emotion_metrics import (
    get_emotion_distribution,
    get_dominant_emotion,
    get_avg_confidence,
    get_avg_emotion_intensity,
    get_emotional_volatility,
    get_stress_ratio,
)

from metrics.energy_metrics import (
    get_avg_energy,
    get_avg_focus,
    get_low_energy_days,
    detect_burnout_risk,
)

from metrics.topic_metrics import get_top_topics

from aggregation.time_series import (
    build_daily_emotion_distribution,
    build_daily_energy,
    build_daily_focus,
    build_daily_note_count,
)

from aggregation.trend import compute_trend
from aggregation.snapshot import build_snapshot
from aggregation.note_sampler import sample_notes
from metrics.time_pattern import analyze_time_patterns
from aggregation.validator import sanitize_notes
from aggregation.zero_notes_snapshot import build_zero_notes_snapshot
from metrics.time_pattern import analyze_time_patterns


def build_report(
    notes: list[dict[str, Any]],
    period: str,
    start_date: date,
    end_date: date,
    previous_report: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Build the complete report JSON payload from a list of note documents.

    Args:
        notes:           All completed notes for the current period,
                         already filtered by userId and date range.
        period:          One of 'daily', 'weekly', 'monthly'.
        start_date:      Start of the reporting window (inclusive).
        end_date:        End of the reporting window (inclusive).
        previous_report: The full report JSON dict generated for the prior
                         period.  Pass None when no prior report exists.

    Returns:
        A dict ready to be JSON-serialised and sent to the LLM.
    """

    # ── For 0 notes    ───────────────────────────────────────────────────────
    if not notes:
        return {
            "period": period,
            "time_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "summary": {
                "note_count": 0,
                "dominant_emotion": None,
                "emotion_distribution": {},
                "avg_emotion_intensity": None,
                "avg_energy": None,
                "avg_focus": None,
                "avg_confidence": None,
                "top_topics": {},
            },
            "time_series": {
                "energy": {},
                "focus": {},
                "emotion_distribution": {},
                "note_count": {},
            },
            "trend": {"available": False, "reason": "No notes this period."},
            "insights": {
                "stress_ratio": 0.0,
                "low_energy_days": 0,
                "burnout_risk": False,
                "emotional_volatility": None,
            },
            "time_patterns": {},
            "note_samples": [],
            "snapshot": build_zero_notes_snapshot(period, start_date, end_date),
        }

    # clean data before any calculations
    notes = sanitize_notes(notes)

    # ── Summary metrics ───────────────────────────────────────────────────────
    emotion_dist = get_emotion_distribution(notes)
    dominant_emotion = get_dominant_emotion(emotion_dist)
    avg_intensity = get_avg_emotion_intensity(notes)
    avg_energy = get_avg_energy(notes)
    avg_focus = get_avg_focus(notes)
    avg_confidence = get_avg_confidence(notes)
    top_topics = get_top_topics(notes, top_n=5)

    summary: dict[str, Any] = {
        "note_count": len(notes),
        "dominant_emotion": dominant_emotion,
        "emotion_distribution": emotion_dist,
        "avg_emotion_intensity": avg_intensity,
        "avg_energy": avg_energy,
        "avg_focus": avg_focus,
        "avg_confidence": avg_confidence,
        "top_topics": top_topics,
    }

    # ── Time series ───────────────────────────────────────────────────────────
    daily_energy = build_daily_energy(notes)
    daily_focus = build_daily_focus(notes)
    daily_count = build_daily_note_count(notes)
    daily_emotion_dist = build_daily_emotion_distribution(notes)

    # ── Insights ──────────────────────────────────────────────────────────────
    volatility = get_emotional_volatility(notes)
    stress_ratio = get_stress_ratio(emotion_dist)
    low_energy_days = get_low_energy_days(daily_energy)
    burnout_risk = detect_burnout_risk(stress_ratio, avg_energy, low_energy_days)

    insights: dict[str, Any] = {
        "stress_ratio": stress_ratio,
        "low_energy_days": low_energy_days,
        "burnout_risk": burnout_risk,
        "emotional_volatility": volatility,
    }

    # ── Time patterns ─────────────────────────────────────────────────────────
    # Behavioural insights derived from WHEN notes were written, not what they
    # contain.  These observations (late-night writing, busiest day, etc.) add
    # a "it knows me" quality to the generated report.
    time_patterns = analyze_time_patterns(notes)

    # ── Trend ─────────────────────────────────────────────────────────────────
    trend = compute_trend(
        current_summary=summary,
        current_insights=insights,
        previous_report=previous_report,
    )

    # ── Assemble report payload ───────────────────────────────────────────────
    report: dict[str, Any] = {
        "period": period,
        "time_range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
        },
        "summary": summary,
        "time_series": {
            "energy": daily_energy,
            "focus": daily_focus,
            "emotion_distribution": daily_emotion_dist,
            "note_count": daily_count,
        },
        "trend": trend,
        "insights": insights,
        "time_patterns": time_patterns,
    }

    # ── Note sampling + snapshot ──────────────────────────────────────────────
    note_samples = sample_notes(notes)

    report["snapshot"] = build_snapshot(report, note_samples=note_samples)

    report["note_samples"] = [
        {
            "sample_role": n.get("sample_role"),
            "date": (
                n["createdAt"].date().isoformat()
                if hasattr(n.get("createdAt"), "date")
                else str(n.get("createdAt", ""))[:10]
            ),
            "summary": n.get("summary") or "",
            "emotion": n.get("analysis", {}).get("emotionPrimary"),
            "energy": n.get("analysis", {}).get("energyLevel"),
        }
        for n in note_samples
    ]

    return report
