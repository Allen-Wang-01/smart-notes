"""
Validates and sanitises note documents before they enter the metric pipeline

Design principles
1. NEVER raise on bad data — always return a usable note.
2. Every repair is recorded in note['_validation']['repairs'].
3. Sanitisation happens once at build_report() entry. All downstream
   metric functions can trust their inputs.
4. The original dict is never mutated — a cleaned copy is returned.

What we validate (mirrors your Mongoose AnalysisSchema)
--------------------------------------------------------
Field               Rule
-----------         -----------------------------------------------
emotionPrimary      Must be in VALID_EMOTIONS; None if missing/invalid
emotionIntensity    float in [0,1]; None if unparseable
energyLevel         float in [0,1]; None if unparseable
focusLevel          float in [0,1]; None if unparseable
confidence          float in [0,1]; None if unparseable
topics              list[str]; coerced from bare string or None
keywords            list[str]; coerced from bare string or None
createdAt           datetime tz-aware; None if unparseable
summary             str; empty string if missing
rawContent          str; empty string if missing
"""

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# Must match Mongoose enum exactly
VALID_EMOTIONS: frozenset[str] = frozenset(
    {"joy", "anxiety", "calm", "stress", "sad", "anger"}
)

_FLOAT_FIELDS: tuple[str, ...] = (
    "emotionIntensity",
    "energyLevel",
    "focusLevel",
    "confidence",
)


# Primitive coercion helpers
def _to_float(value: Any) -> float | None:
    """
    Coerce value to float. Returns None if conversion is impossible
    bool is explicitly rejected - True / False would silently become 1.0/0.0
    """
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _clamp(value: float | None, lo: float = 0.0, hi: float = 1.0) -> float | None:
    """
    Clamp to [lo, hi]. Preserves None to distinguish 'no data' from 0
    """
    if value is None:
        return None
    return max(lo, min(hi, value))


def _to_str_list(value: Any) -> list[str]:
    """
    Coerce to list[str]. Handles None, bare string, list with non-strings
    """
    if value is None:
        return []
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    if isinstance(value, (list, tuple)):
        return [
            str(item).strip()
            for item in value
            if item is not None and str(item).strip()
        ]
    return []


def _parse_datetime(value: Any) -> datetime | None:
    """
    Parse to timezone-aware datetime.
    Returns None on failure - note still contributes to emotion metrics,
    just not time-series calculations.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


# ── Analysis sub-document sanitiser ──────────────────────────────────────────
def _sanitize_analysis(
    raw: Any,
    note_id: str,
    repairs: list[str],
) -> dict[str, Any]:
    """
    Validate and clean the analysis sub-document.
    Appends human-readable repair descriptions to `repairs`
    """
    if not isinstance(raw, dict):
        repairs.append(
            f"analysis was {type(raw).__name__} not dict — replaced with empty defaults"
        )
        logger.warning("note %s: analysis field missing or wrong type", note_id)
        raw = {}
    clean: dict[str, Any] = {}

    # emotionPrimary
    emotion = raw.get("emotionPrimary")
    if isinstance(emotion, str) and emotion in VALID_EMOTIONS:
        clean["emotionPrimary"] = emotion
    else:
        clean["emotionPrimary"] = None
        if emotion not in (None, ""):
            repairs.append(
                f"emotionPrimary '{emotion}' not in VALID_EMOTIONS — set to None"
            )
            logger.warning(
                "note %s: invalid emotionPrimary '%s' (valid: %s)",
                note_id,
                emotion,
                sorted(VALID_EMOTIONS),
            )

    # Float fields
    for field in _FLOAT_FIELDS:
        original = raw.get(field)
        parsed = _to_float(original)

        if parsed is None and original is not None:
            repairs.append(
                f"{field} value {original!r} could not be parsed as float - set to None"
            )
            logger.warning("note %s: unparseable %s=%r", note_id, field, original)
            clean[field] = None
            continue

        clamped = _clamp(parsed)
        if parsed is not None and clamped != parsed:
            repairs.append(f"{field}={parsed} was outside [0,1] — clamped to {clamped}")
            logger.warning(
                "note %s: %s=%s out of range, clamped to %s",
                note_id,
                field,
                parsed,
                clamped,
            )
        clean[field] = clamped

    # topics
    raw_topics = raw.get("topics")
    clean["topics"] = _to_str_list(raw_topics)
    if raw_topics is not None and not isinstance(raw_topics, list):
        repairs.append(f"topics was {type(raw_topics).__name__} — coerced to list")
    return clean


# ── Public API ─────────────────────────────────────────────────────────────
def sanitize_note(note: dict[str, Any]) -> dict[str, Any]:
    """
    Validate and sanitise a single note document.
    Returns a new dict with a '_validation' key added:
        repairs    : list[str]  descriptions of every repair made
        has_repairs: bool       True if any repair was needed

    Never raises.
    """
    note_id = str(note.get("_id", "<unknown>"))
    repairs: list[str] = []

    # createdAt
    raw_dt = note.get("createdAt")
    parsed_dt = _parse_datetime(raw_dt)

    if parsed_dt is None and raw_dt is not None:
        repairs.append(
            f"createdAt {raw_dt!r} could not be parsed — "
            "excluded from time-series calculations"
        )
        logger.warning("note %s: unparseable createdAt %r", note_id, raw_dt)

    # string fields
    summary = note.get("summary")
    raw_content = note.get("rawContent")
    clean_summary = summary.strip() if isinstance(summary, str) else ""
    clean_raw = raw_content.strip() if isinstance(raw_content, str) else ""

    # List fields
    clean_keywords = _to_str_list(note.get("keywords"))

    # Analysis
    clean_analysis = _sanitize_analysis(note.get("analysis"), note_id, repairs)

    return {
        **note,
        "createdAt": parsed_dt,
        "summary": clean_summary,
        "rawContent": clean_raw,
        "keywords": clean_keywords,
        "analysis": clean_analysis,
        "_validation": {
            "repairs": repairs,
            "has_repairs": bool(repairs),
        },
    }


def sanitize_notes(notes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Sanitise a list of note documents.

    Notes with unparseable createdAt are still included - they just won't
    contribute to time-series calculations. No note is silently dropped.
    """
    cleaned = [sanitize_note(n) for n in notes]

    repaired = sum(1 for n in cleaned if n["_validation"]["has_repairs"])

    if repaired:
        logger.warning(
            "%d/%d notes had data quality issues and were repaired",
            repaired,
            len(cleaned),
        )

    return cleaned
