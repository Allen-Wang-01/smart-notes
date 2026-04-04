"""
Converts the structured report JSON into a natural-language snapshot string
that an LLM can immediately understand and use to generate an emotional report.

Design goals
------------
- Every number is given a human label so the LLM never has to guess units.
- Absent / None values are explicitly described as "no data available" rather
  than being silently omitted, so the LLM won't hallucinate values.
- Key note moments (sampled by note_sampler) are woven in so the report
  feels grounded in the user's actual words, not just statistics.
- The snapshot is intentionally verbose and redundant; LLMs compress it well.
- Sections are separated by clear headers so the LLM can navigate the context.
"""

from typing import Any

# ── Emotion label helpers ─────────────────────────────────────────────────────

_EMOTION_LABELS: dict[str, str] = {
    "joy": "joy / happiness",
    "calm": "calm / relaxed",
    "stress": "stress / pressure",
    "anxiety": "anxiety / worry",
    "sad": "sadness / low mood",
    "anger": "anger / frustration",
}

_ROLE_LABELS: dict[str, str] = {
    "peak_intensity": "Most emotionally intense moment",
    "low_energy": "Lowest energy moment",
    "positive_moment": "Brightest / most positive moment",
    "turning_point": "Biggest emotional shift / turning point",
}


def _emotion_label(emotion: str | None) -> str:
    """Return a descriptive label for an emotion code, or 'unknown'."""
    if emotion is None:
        return "unknown"
    return _EMOTION_LABELS.get(emotion, emotion)


def _pct(value: float | None) -> str:
    """Format a 0-1 ratio as a percentage string, or 'N/A'."""
    if value is None:
        return "N/A"
    return f"{round(value * 100)}%"


def _score(value: float | None) -> str:
    """Format a 0-1 score as 'X/10', or 'N/A'."""
    if value is None:
        return "N/A"
    return f"{round(value * 10, 1)}/10"


def _delta(value: float | None, unit: str = "") -> str:
    """
    Format a signed delta value with an arrow indicator.
    e.g.  0.08  → '▲ +0.08 {unit}'
          -0.05 → '▼ -0.05 {unit}'
          0.0   → '→ no change {unit}'
          None  → 'N/A'
    """
    if value is None:
        return "N/A"
    suffix = f" {unit}" if unit else ""
    if value > 0.005:
        return f"▲ +{value}{suffix}"
    if value < -0.005:
        return f"▼ {value}{suffix}"
    return f"→ no change{suffix}"


def _int_delta(value: int | None) -> str:
    """Format a signed integer delta, or 'N/A'."""
    if value is None:
        return "N/A"
    if value > 0:
        return f"▲ +{value}"
    if value < 0:
        return f"▼ {value}"
    return "→ no change"


# ── Section builders ──────────────────────────────────────────────────────────


def _build_overview(report: dict[str, Any]) -> str:
    tr = report.get("time_range", {})
    period = report.get("period", "unknown")
    start = tr.get("start", "?")
    end = tr.get("end", "?")
    return (
        f"[OVERVIEW]\n"
        f"Report period : {period}\n"
        f"Date range    : {start} to {end}\n"
    )


def _build_summary(summary: dict[str, Any]) -> str:
    note_count = summary.get("note_count", "N/A")
    dominant = _emotion_label(summary.get("dominant_emotion"))
    avg_intensity = _score(summary.get("avg_emotion_intensity"))
    avg_energy = _score(summary.get("avg_energy"))
    avg_focus = _score(summary.get("avg_focus"))
    avg_confidence = _score(summary.get("avg_confidence"))

    # Emotion distribution — sorted by ratio descending
    emotion_dist = summary.get("emotion_distribution", {})
    if emotion_dist:
        dist_lines = ", ".join(
            f"{_emotion_label(e)} {_pct(r)}"
            for e, r in sorted(emotion_dist.items(), key=lambda x: -x[1])
        )
    else:
        dist_lines = "no emotion data"

    # Top topics
    top_topics = summary.get("top_topics", {})
    if top_topics:
        topics_line = ", ".join(
            f'"{t}" (mentioned {c} times)' for t, c in top_topics.items()
        )
    else:
        topics_line = "no topics recorded"

    return (
        f"[SUMMARY]\n"
        f"Total notes recorded  : {note_count}\n"
        f"Dominant emotion      : {dominant}\n"
        f"Emotion breakdown     : {dist_lines}\n"
        f"Avg emotion intensity : {avg_intensity}  "
        f"(0 = flat / numb, 10 = extremely intense feelings)\n"
        f"Avg energy level      : {avg_energy}  "
        f"(0 = exhausted, 10 = highly energised)\n"
        f"Avg focus level       : {avg_focus}  "
        f"(0 = scattered, 10 = laser-focused)\n"
        f"Avg analysis confidence: {avg_confidence}  "
        f"(how reliable the emotion analysis is)\n"
        f"Most discussed topics : {topics_line}\n"
    )


def _build_key_moments(note_samples: list[dict[str, Any]]) -> str:
    """
    Render sampled notes as a [KEY MOMENTS] section.

    Each note is shown with:
      - Its role label (why it was selected)
      - The date it was written
      - The AI-generated summary (the user's own words, compressed)
      - Key emotion metadata to help the LLM contextualise the text
    """
    if not note_samples:
        return (
            "[KEY MOMENTS FROM THIS PERIOD]\n"
            "No individual note highlights available.\n"
        )

    lines = ["[KEY MOMENTS FROM THIS PERIOD]"]
    lines.append(
        "The following notes were selected as emotionally significant moments. "
        "Use them to ground the report in the user's actual experiences.\n"
    )

    for i, note in enumerate(note_samples, start=1):
        role = note.get("sample_role", "notable_moment")
        role_label = _ROLE_LABELS.get(role, role.replace("_", " ").title())

        # Date
        created_at = note.get("createdAt")
        if isinstance(created_at, __import__("datetime").datetime):
            date_str = created_at.date().isoformat()
        else:
            date_str = str(created_at)[:10] if created_at else "unknown date"

        # Emotion metadata
        analysis = note.get("analysis", {})
        emotion = _emotion_label(analysis.get("emotionPrimary"))
        intensity = _score(analysis.get("emotionIntensity"))
        energy = _score(analysis.get("energyLevel"))
        focus = _score(analysis.get("focusLevel"))

        # Content block: AI summary + user's original words side by side.
        # The raw_excerpt is the user's unedited voice — the most personal element.
        summary_text = (note.get("summary") or "").strip()
        raw_excerpt = (note.get("raw_excerpt") or "").strip()

        lines.append(f"--- Moment {i}: {role_label} ---")
        lines.append(f"Date      : {date_str}")
        lines.append(
            f"Emotion   : {emotion}  |  Intensity {intensity}  |  Energy {energy}  |  Focus {focus}"
        )
        if raw_excerpt:
            lines.append(f'In their own words : "{raw_excerpt}"')
        if summary_text:
            lines.append(f"AI summary         : {summary_text}")
        lines.append("")  # blank line between moments

    return "\n".join(lines)


def _build_time_series(time_series: dict[str, Any]) -> str:
    energy_ts = time_series.get("energy", {})
    focus_ts = time_series.get("focus", {})
    count_ts = time_series.get("note_count", {})

    if not energy_ts and not focus_ts:
        return "[DAILY BREAKDOWN]\nNo daily data available.\n"

    all_days = sorted(
        set(list(energy_ts.keys()) + list(focus_ts.keys()) + list(count_ts.keys()))
    )

    lines = ["[DAILY BREAKDOWN]"]
    lines.append(f"{'Date':<14} {'Energy':>8} {'Focus':>8} {'Notes':>7}")
    lines.append("-" * 42)

    for day in all_days:
        e = _score(energy_ts.get(day))
        f = _score(focus_ts.get(day))
        n = count_ts.get(day, "-")
        lines.append(f"{day:<14} {e:>8} {f:>8} {str(n):>7}")

    return "\n".join(lines) + "\n"


def _build_trend(trend: dict[str, Any]) -> str:
    available = trend.get("available", False)

    if not available:
        reason = trend.get("reason", "No previous period data.")
        return (
            f"[TREND vs PREVIOUS PERIOD]\n"
            f"Trend comparison is not available: {reason}\n"
            f"This may be the user's first report or the previous report was not found.\n"
        )

    energy_ch = _delta(trend.get("energy_change"), "energy pts")
    focus_ch = _delta(trend.get("focus_change"), "focus pts")
    count_ch = _int_delta(trend.get("note_count_change"))
    dominant_changed = trend.get("dominant_emotion_changed")
    stress_ch = _delta(trend.get("stress_ratio_change"))
    vol_ch = _delta(trend.get("volatility_change"))

    dominant_line = (
        "Yes — the user's primary emotional tone has shifted this period."
        if dominant_changed
        else "No — the user's primary emotional tone remained the same."
    )

    return (
        f"[TREND vs PREVIOUS PERIOD]\n"
        f"Energy change              : {energy_ch}\n"
        f"Focus change               : {focus_ch}\n"
        f"Note count change          : {count_ch}\n"
        f"Dominant emotion changed   : {dominant_line}\n"
        f"Stress ratio change        : {stress_ch}  "
        f"(positive = more stressed than last period)\n"
        f"Emotional volatility change: {vol_ch}  "
        f"(positive = more emotionally unstable than last period)\n"
    )


def _build_insights(insights: dict[str, Any]) -> str:
    stress_ratio = _pct(insights.get("stress_ratio"))
    low_energy_days = insights.get("low_energy_days", "N/A")
    burnout_risk = insights.get("burnout_risk")
    volatility = insights.get("emotional_volatility")

    burnout_line = (
        "YES — the user shows signs of potential burnout based on sustained high stress, "
        "low energy, and multiple low-energy days."
        if burnout_risk
        else "No significant burnout indicators detected."
    )

    vol_description = "N/A"
    if volatility is not None:
        if volatility < 0.15:
            vol_description = f"{volatility} (emotionally stable)"
        elif volatility < 0.30:
            vol_description = f"{volatility} (moderate emotional fluctuation)"
        else:
            vol_description = (
                f"{volatility} (high emotional volatility — mood swings present)"
            )

    return (
        f"[WELLBEING INSIGHTS]\n"
        f"Stress proportion  : {stress_ratio} of all notes carry a stress emotion\n"
        f"Low-energy days    : {low_energy_days} day(s) where avg energy fell below 40%\n"
        f"Burnout risk flag  : {burnout_line}\n"
        f"Emotional volatility: {vol_description}\n"
    )


def _build_time_patterns(patterns: dict[str, Any]) -> str:
    """
    Render the [TIME PATTERNS] section from analyze_time_patterns() output.

    These observations reveal habits the user may not be consciously aware of,
    which is what gives this section its "it knows me" quality in the report.
    """
    if not patterns or patterns.get("total_notes_analysed", 0) == 0:
        return "[TIME PATTERNS]\nNo timing data available.\n"

    lines = ["[TIME PATTERNS]"]
    lines.append(
        "The following patterns describe WHEN and HOW the user writes — "
        "behavioural habits that add a layer of self-awareness to the report.\n"
    )

    # ── Writing session distribution ──────────────────────────────────────────
    session_dist = patterns.get("session_distribution", {})
    if session_dist:
        session_line = ", ".join(
            f"{session} {_pct(ratio)}"
            for session, ratio in sorted(session_dist.items(), key=lambda x: -x[1])
        )
        lines.append(f"Writing time distribution : {session_line}")

    most_active_session = patterns.get("most_active_session")
    if most_active_session:
        lines.append(
            f"Most active time of day   : {most_active_session} "
            f"(this is when the user most often captures their thoughts)"
        )

    # ── Most active weekday ───────────────────────────────────────────────────
    most_active_day = patterns.get("most_active_day")
    if most_active_day:
        lines.append(f"Most active weekday       : {most_active_day}")

    # ── Busiest single day ────────────────────────────────────────────────────
    busiest_date = patterns.get("busiest_date")
    busiest_count = patterns.get("busiest_date_note_count")
    if busiest_date and busiest_count:
        lines.append(
            f"Most notes in a single day: {busiest_count} notes on {busiest_date}"
        )

    # ── Average notes per active day ─────────────────────────────────────────
    avg_per_day = patterns.get("avg_notes_per_active_day")
    if avg_per_day is not None:
        lines.append(f"Avg notes per active day  : {avg_per_day}")

    # ── Late night writing ────────────────────────────────────────────────────
    late_night_ratio = patterns.get("late_night_ratio")
    if late_night_ratio is not None:
        if late_night_ratio >= 0.3:
            late_label = (
                f"{_pct(late_night_ratio)} of notes written late at night (22:00–05:00) — "
                "this user writes significantly during late hours"
            )
        elif late_night_ratio > 0:
            late_label = f"{_pct(late_night_ratio)} of notes written late at night"
        else:
            late_label = "No late-night writing detected"
        lines.append(f"Late-night writing        : {late_label}")

    # ── Night vs daytime emotion correlation ──────────────────────────────────
    corr = patterns.get("night_stress_correlation")
    if corr:
        lines.append(
            f"Night vs daytime pattern  : {corr['observation']} "
            f"(late-night avg intensity {_score(corr.get('late_night_avg_intensity'))} "
            f"vs daytime {_score(corr.get('other_avg_intensity'))}; "
            f"late-night avg energy {_score(corr.get('late_night_avg_energy'))} "
            f"vs daytime {_score(corr.get('other_avg_energy'))})"
        )

    lines.append(
        "\nLLM instruction: Weave 1-2 of the most interesting time patterns naturally "
        "into the report narrative. Do not list them mechanically — translate them "
        "into an observation the user would find surprising or insightful "
        "(e.g. 'You tend to open this app when the day gets heavy...')."
    )

    return "\n".join(lines) + "\n"


def _build_instruction() -> str:
    return (
        "[REPORT GENERATION INSTRUCTIONS]\n"
        "Using all the data above, write a warm, empathetic, first-person emotional "
        "wellness report for this user. Structure the report with:\n"
        "1. An opening paragraph reflecting the overall emotional tone of the period.\n"
        "2. A 'highlights' section — reference the specific positive moment(s) from "
        "[KEY MOMENTS] using the user's own words from the note summaries.\n"
        "3. A 'challenges' section — reference the low-energy or high-stress moments "
        "from [KEY MOMENTS] to make the challenges feel real and specific.\n"
        "4. A 'trends' section comparing this period to the previous one "
        "(skip this section entirely if trend data is unavailable).\n"
        "5. A closing paragraph with 2-3 actionable, compassionate suggestions "
        "that directly respond to the themes and struggles mentioned in the notes.\n"
        "Tone: warm, non-judgmental, encouraging. Write as if you deeply know this person.\n"
        "Do not reproduce raw numbers verbatim — translate them into meaningful language.\n"
        "Do weave in paraphrased references to the key moments so the report feels personal.\n"
        "\n"
        "[OUTPUT FORMAT — STRICT JSON]\n"
        "You MUST respond with a single JSON object and nothing else.\n"
        "No markdown, no code fences, no explanation outside the JSON.\n"
        "The object must have exactly these two keys:\n"
        "\n"
        "  summary    : array of 2-4 strings, each string is one paragraph of the report.\n"
        "               Follow the 5-part structure above across these paragraphs.\n"
        "               Each paragraph should be 2-4 sentences.\n"
        "\n"
        "  poeticLine : a single evocative closing line (5-200 characters).\n"
        "               Inspired by the emotional theme of this period.\n"
        "               Should feel like a Spotify year-in-review caption —\n"
        "               poetic, personal, quietly beautiful.\n"
    )


# ── Public API ────────────────────────────────────────────────────────────────


def build_snapshot(
    report: dict[str, Any],
    note_samples: list[dict[str, Any]] | None = None,
) -> str:
    """
    Convert a report JSON dict (output of build_report()) into a structured
    natural-language snapshot string ready to be embedded in an LLM prompt.

    Args:
        report:       The full report dict as returned by aggregator.build_report().
        note_samples: Output of note_sampler.sample_notes().  Each note should
                      have 'sample_role' and 'raw_excerpt' fields attached.

    Returns:
        A multi-section plaintext string the LLM can understand without
        knowing the underlying data schema.
    """
    summary = report.get("summary", {})
    time_series = report.get("time_series", {})
    trend = report.get("trend", {})
    insights = report.get("insights", {})
    time_patterns = report.get("time_patterns", {})

    sections = [
        _build_overview(report),
        _build_summary(summary),
        _build_key_moments(note_samples or []),
        _build_time_series(time_series),
        _build_time_patterns(time_patterns),
        _build_trend(trend),
        _build_insights(insights),
        _build_instruction(),
    ]

    return "\n".join(sections)
