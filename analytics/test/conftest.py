"""
Shared pytest fixtures used across all test modules.

Fixtures follow the builder pattern: start with a clean base note dict
and override only what each test needs. This avoids copy-paste across
test filed while keeping each test's intent readable.
"""

import pytest
from datetime import date, datetime, timezone

# Note factory


def make_note(
    note_id: str = "n1",
    emotion: str = "calm",
    intensity: float = 0.5,
    energy: float = 0.5,
    focus: float = 0.8,
    confidence: float = 0.8,
    topics: list | None = None,
    keywords: list | None = None,
    hour: int = 10,
    day: int = 17,
    month: int = 2,
    year: int = 2026,
    summary: str = "A note.",
    raw: str = "some raw content",
) -> dict:
    """
    Build a minimal, valid note dict for testing.
    All fields match the shape expected from MongoDB after JSON deserialisation.
    """
    return {
        "_id": note_id,
        "userId": "user_test",
        "rawContent": raw,
        "keywords": keywords if keywords is not None else [],
        "summary": summary,
        "createdAt": datetime(year, month, day, hour, 0, tzinfo=timezone.utc),
        "analysis": {
            "emotionPrimary": emotion,
            "emotionIntensity": intensity,
            "energyLevel": energy,
            "focusLevel": focus,
            "topics": topics if topics is not None else [],
            "confidence": confidence,
        },
    }


# Fixtures
@pytest.fixture
def note_factory():
    """
    Return the make_note helper so test files can call it directly
    """
    return make_note


@pytest.fixture
def single_note():
    """
    One clean, valid note
    """
    return make_note()


@pytest.fixture
def stress_note():
    return make_note(
        note_id="stress_1",
        emotion="stress",
        intensity=0.85,
        energy=0.30,
        focus=0.45,
        topics=["work", "deadline"],
        keywords=["deadline", "pressure"],
        hour=23,
        raw="This deadline is killing me, I feel like I'm falling apart.",
        summary="User felt overwhelmed by deadlines.",
    )


@pytest.fixture
def joy_note():
    return make_note(
        note_id="joy_1",
        emotion="joy",
        intensity=0.70,
        energy=0.65,
        focus=0.60,
        topics=["social"],
        keywords=["team", "coffee"],
        hour=14,
        day=18,
        raw="coffee chat with team was really nice",
        summary="Positive team interaction lifted mood.",
    )


@pytest.fixture
def calm_note():
    return make_note(
        note_id="calm_1",
        emotion="calm",
        intensity=0.40,
        energy=0.55,
        focus=0.65,
        topics=["personal"],
        hour=17,
        day=20,
        raw="wrapped up early, going for a walk",
        summary="User felt relaxed after finishing early.",
    )


@pytest.fixture
def four_note_week(stress_note, joy_note, calm_note):
    """A realistic weekly note set: stress → joy → stress → calm."""
    second_stress = make_note(
        note_id="stress_2",
        emotion="stress",
        intensity=0.75,
        energy=0.38,
        focus=0.50,
        topics=["work"],
        hour=0,
        day=19,
        raw="can't sleep, project review tomorrow",
        summary="Anxiety about project review.",
    )
    return [stress_note, joy_note, second_stress, calm_note]


@pytest.fixture
def report_dates():
    """Standard weekly date range used across integration tests."""
    return {
        "start": date(2026, 2, 17),
        "end": date(2026, 2, 23),
    }


@pytest.fixture
def previous_report():
    """A realistic previous-period report for trend computation tests."""
    return {
        "summary": {
            "note_count": 6,
            "dominant_emotion": "calm",
            "avg_energy": 0.55,
            "avg_focus": 0.62,
        },
        "insights": {
            "stress_ratio": 0.17,
            "emotional_volatility": 0.09,
        },
    }
