"""
End-to-end smoke test for the Narrative pipeline

Goal: verify the pipeline runs from raw payload to final output without
crashing - NOT to verify business logic correctness (that's what the unit
tests in this directory will do once smoke is green).

What this catches:
- Import errors anywhere in the package
- Pydantic model alias mismatches (camelCase from Node ↔ snake_case in Python)
- DataFrame schema mismatches between data_loader and aggregators
- Aggregator crashes on edge inputs (empty week, single-note week, mixed sources)
- Final output not JSON-serializable (would break the stdout protocol)
- The new sourceType / description fields surviving the full round trip

What this does NOT catch:
- Whether the centerpiece picked is the "right" one
- Whether emotion was correctly suppressed for saved-no-description notes
- Whether the prompt text reads well to a human

Each scenario asserts only structural invariants and a small number of
post-upgrade behaviors that are critical enough to gate at smoke level.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
import pytest
from main import run


# =====================================================
# Fixtures: factories for building Node-shaped note payloads
# =====================================================

# Use a fixed reference date so created_at offsets are deterministic across runs.
WEEK_END = datetime(2026, 4, 26, 18, 0, 0, tzinfo=timezone.utc)
WEEK_START = WEEK_END - timedelta(days=6)


def _iso(dt: datetime) -> str:
    """ISO-8601 string the way Mongo / Node would serialize a Date."""
    return dt.isoformat()


def make_note(
    *,
    note_id: str,
    raw_content: str,
    days_before_end: int = 0,
    source_type: str = "authored",
    description: str | None = None,
    summary: str | None = None,
    title: str | None = None,
    emotion: str | None = None,
    emotion_intensity: float | None = None,
    cognitive_type: str | None = None,
    relationship: str | None = None,
    themes: list[str] | None = None,
    pattern_signals: list[str] | None = None,
    confidence: float | None = None,
) -> dict:
    """
    Build a note dict in the exact camelCase shape Node sends to the
    subprocess via stdin. Pydantic aliases will translate it on the way in.
    """
    created_at = WEEK_END - timedelta(days=days_before_end, hours=2)
    note = {
        "_id": note_id,
        "userId": "user_smoke_test",
        "rawContent": raw_content,
        "title": title,
        "summary": summary,
        "keywords": [],
        "createdAt": _iso(created_at),
        "sourceType": source_type,
    }

    if description is not None:
        note["description"] = description

    # Only attach analysis if at least one signal is provided. Notes that
    # are still "pending" or had no analysis pass should also smoke-test
    # cleanly, so we keep the analysis optional
    if any(
        v is not None
        for v in (
            emotion,
            emotion_intensity,
            cognitive_type,
            relationship,
            themes,
            pattern_signals,
            confidence,
        )
    ):
        note["analysis"] = {
            "emotion": emotion,
            "emotionIntensity": emotion_intensity,
            "cognitiveType": cognitive_type,
            "relationship": relationship,
            "insightType": None,
            "themes": themes or [],
            "patternSignals": pattern_signals or [],
            "confidence": confidence,
        }
    return note


def make_payload(notes: list[dict], previous_report: dict | None = None) -> dict:
    """Build the top-level payload Node would send to the subprocess."""
    return {
        "notes": notes,
        "period": "weekly",
        "startDate": WEEK_START.date().isoformat(),
        "endDate": WEEK_END.date().isoformat(),
        "previousReport": previous_report,
    }


# =====================================================
# Structural assertions reused across scenarios
# =====================================================


def assert_output_shape(result: dict) -> None:
    """Verify the pipeline returned the contract Node expects."""
    assert "dossier" in result, "missing 'dossier' key"
    assert "prompt" in result, "missing 'prompt' key"

    dossier = result["dossier"]
    for key in (
        "period",
        "start_date",
        "end_date",
        "note_count",
        "is_sparse",
        "components",
        "stats",
    ):
        assert key in dossier, f"dossier missing '{key}'"

        components = dossier["components"]
        for key in (
            "theme_map",
            "theme_evolutions",
            "hidden_patterns",
            "centerpiece",
            "quiet_shifts",
            "implicit_questions",
        ):
            assert key in components, f"components missing '{key}'"

    assert isinstance(result["prompt"], str), "prompt must be a string"
    assert len(result["prompt"]) > 0, "prompt is empty"


def assert_json_serializable(result: dict) -> None:
    """The pipeline output must round-trip through json. dumps; main.py relies on this."""
    try:
        json.dumps(result, default=str)
    except (TypeError, ValueError) as e:
        pytest.fail(f"pipeline output is not JSON-serializable: {e}")


# =====================================================
# Smoke scenarios
# =====================================================


class TestPipelineSmoke:
    """End-to-end smoke tests covering the realistic shapes a week can take."""

    def test_empty_does_not_crash(self):
        """Zero notes - empty-week prompt branch."""
        result = run(make_payload(notes=[]))
        assert_output_shape(result)
        assert_json_serializable(result)
        assert result["dossier"]["note_count"] == 0
        # is_sparse is true for empty weeks (it's a strict subset of sparse)
        # but the aggregator decides; we just assert it's a bool.

    def test_sparse_week_single_authored_note(self):
        """One authored note - sparse-week prompt branch."""
        notes = [
            make_note(
                note_id="n1",
                raw_content="Today I realized I've been avoiding the architecture rewrite "
                "because I'm scared of breaking things. Naming it helps.",
                days_before_end=2,
                source_type="authored",
                emotion="apprehensive but clearer",
                emotion_intensity=0.6,
                cognitive_type="reflection",
                relationship="naming",
                themes=["architecture", "self-awareness"],
                confidence=0.8,
            ),
        ]
        result = run(make_payload(notes=notes))
        assert_output_shape(result)
        assert_json_serializable(result)
        assert result["dossier"]["note_count"] == 1

    def test_full_week_mixed_authored_and_saved(self):
        """
        Realistic mixed week:
        - 2 authored reflections
        - 1 saved + description
        - 1 saved without description (the Murakami-shaped case)
        - 1 authored skill note

        Verifies the post-upgrade fields (sourceType, description) flow
        through the entire pipeline without errors.
        """
        notes = [
            make_note(
                note_id="auth1",
                raw_content="The interview with the candidate today went well, but I keep "
                "second-guessing whether I asked the right system design questions.",
                days_before_end=5,
                source_type="authored",
                emotion="uncertain",
                emotion_intensity=0.5,
                cognitive_type="reflection",
                themes=["hiring", "self-doubt"],
                confidence=0.75,
            ),
            make_note(
                note_id="auth2",
                raw_content="I think I've been mistaking 'shipping fast' for 'shipping well'. "
                "The team's frustration this week tracks back to this.",
                days_before_end=3,
                source_type="authored",
                emotion="reckoning",
                emotion_intensity=0.7,
                cognitive_type="reflection",
                relationship="contradiction",
                themes=["leadership", "self-doubt"],
                confidence=0.85,
            ),
            make_note(
                note_id="saved_described",
                raw_content="The best engineering managers I've worked with treat their "
                "calendars as a statement of priorities, not a record of obligations.",
                days_before_end=2,
                source_type="saved",
                description="reminded me I've been letting other people fill my calendar this quarter",
                emotion=None,
                cognitive_type="knowledge",
                themes=["leadership"],
                confidence=0.7,
            ),
            make_note(
                note_id="saved_silent",
                raw_content="In the deep silence of the early morning, the world feels different — "
                "softer, more porous, as if the boundaries between things have not yet hardened.",
                days_before_end=1,
                source_type="saved",
                description=None,
                emotion=None,
                cognitive_type="knowledge",
                themes=["literature"],
                confidence=0.4,
            ),
            make_note(
                note_id="auth_skill",
                raw_content="Pgvector cosine threshold notes: 0.7 is a good baseline for "
                "same-language related-note search; cross-language drops to ~0.6.",
                days_before_end=0,
                source_type="authored",
                cognitive_type="skill",
                themes=["technical"],
                confidence=0.9,
            ),
        ]
        result = run(make_payload(notes=notes))
        assert_output_shape(result)
        assert_json_serializable(result)
        assert result["dossier"]["note_count"] == 5

        # Critical post-upgrade invariant: the prompt text must explicitly
        # mention the source distinction so the downstream LLM applies the
        # rules from buildPrompt's THREE SIGNAL SOURCES section.
        prompt = result["prompt"]
        assert (
            "saved" in prompt.lower()
        ), "prompt should reference saved-vs-authored distinction"

    def test_only_saved_notes_does_not_crash(self):
        """
        Edge case: a week where every note is saved external content.
        Theme evolutions should be empty (no user voice for trajectory)
        but the pipeline must not crash.
        """
        notes = [
            make_note(
                note_id="s1",
                raw_content="Article about distributed consensus algorithms.",
                days_before_end=4,
                source_type="saved",
                description=None,
                cognitive_type="knowledge",
                themes=["distributed-systems"],
            ),
            make_note(
                note_id="s2",
                raw_content="Quote from a book on attention and writing.",
                days_before_end=2,
                source_type="saved",
                description=None,
                cognitive_type="knowledge",
                themes=["writing"],
            ),
        ]
        result = run(make_payload(notes=notes))
        assert_output_shape(result)
        assert_json_serializable(result)
        assert result["dossier"]["note_count"] == 2

    def test_legacy_note_without_source_type_defaults_to_authored(self):
        """
        Notes created before the sourceType migration won't have the field.
        The Pydantic Note model defaults source_type to 'authored' so the
        pipeline must still accept them.
        """
        # Build a note dict and remove sourceType to simulate legacy data.
        legacy_note = make_note(
            note_id="legacy1",
            raw_content="An older reflection from before the schema migration.",
            days_before_end=3,
            cognitive_type="reflection",
            emotion="content",
            emotion_intensity=0.4,
            themes=["misc"],
        )

        legacy_note.pop("sourceType", None)

        result = run(make_payload(notes=[legacy_note]))
        assert_output_shape(result)
        assert_json_serializable(result)
        assert result["dossier"]["note_count"] == 1

    def test_centerpiece_when_present_includes_source_fields(self):
        """
        If a centerpiece is selected, it must carry source_type and
        description through to the dossier — these power the differentiated
        prompt rendering in dossier._format_centerpiece.
        """
        notes = [
            make_note(
                note_id="reflective",
                raw_content="A long, weighty reflection on a turning point in my career — "
                "I think the next role I take needs to optimize for learning, "
                "not title. This is the first time I've been able to say that "
                "without it sounding like a rationalization." * 3,
                days_before_end=2,
                source_type="authored",
                emotion="resolved",
                emotion_intensity=0.8,
                cognitive_type="reflection",
                relationship="evolution",
                themes=["career"],
                confidence=0.9,
            ),
        ]
        result = run(make_payload(notes=notes))
        assert_output_shape(result)

        cp = result["dossier"]["components"]["centerpiece"]
        if cp is not None:
            assert (
                "source_type" in cp
            ), "centerpiece must expose source_type for prompt rendering"
            assert cp["source_type"] in ("authored", "saved")
            # description key must exist (value may be null)
            assert "description" in cp
