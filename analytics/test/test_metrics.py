"""
Test for all metrics modules using pytest
"""

import pytest

from metrics.emotion_metrics import (
    get_emotion_distribution,
    get_dominant_emotion,
    get_avg_emotion_intensity,
    get_avg_confidence,
    get_emotional_volatility,
    get_stress_ratio,
)

from metrics.energy_metrics import (
    get_avg_energy,
    get_avg_focus,
    get_low_energy_days,
    detect_burnout_risk,
)

from metrics.topic_metrics import get_top_keywords, get_top_topics
from metrics.time_pattern import analyze_time_patterns


class TestEmotionDistribution:
    def test_empty_returns_empty_dict(self):
        assert get_emotion_distribution([]) == {}

    def test_single_emotion_is_100_percent(self, note_factory):
        notes = [note_factory(emotion="stress"), note_factory(emotion="stress")]
        assert get_emotion_distribution(notes) == {"stress": 1.0}

    def test_ratios_sum_to_one(self, note_factory):
        notes = [
            note_factory(emotion="stress"),
            note_factory(emotion="joy"),
            note_factory(emotion="stress"),
        ]
        dist = get_emotion_distribution(notes)
        assert sum(dist.values()) == pytest.approx(1.0)

    def test_correct_ratios(self, note_factory):
        notes = [
            note_factory(emotion="stress"),
            note_factory(emotion="joy"),
            note_factory(emotion="stress"),
        ]
        dist = get_emotion_distribution(notes)
        assert dist["stress"] == pytest.approx(2 / 3, abs=1e-4)
        assert dist["joy"] == pytest.approx(1 / 3, abs=1e-4)

    def test_dominant_empty_returns_none(self):
        assert get_dominant_emotion({}) is None

    def test_dominant_returns_highest(self):
        assert get_dominant_emotion({"stress": 0.6, "joy": 0.4}) == "stress"


class TestAvgEmotionIntensity:

    def test_empty_returns_none(self):
        assert get_avg_emotion_intensity([]) is None

    def test_single_note(self, note_factory):
        assert get_avg_emotion_intensity(
            [note_factory(intensity=0.8)]
        ) == pytest.approx(0.8)

    def test_average_of_multiple(self, note_factory):
        notes = [note_factory(intensity=0.4), note_factory(intensity=0.6)]
        assert get_avg_emotion_intensity(notes) == pytest.approx(0.5)

    def test_none_intensity_skipped(self, note_factory):
        note = note_factory()
        note["analysis"]["emotionIntensity"] = None
        assert get_avg_emotion_intensity([note]) is None

    def test_confidence_empty_returns_none(self):
        assert get_avg_confidence([]) is None

    def test_confidence_computed(self, note_factory):
        notes = [note_factory(confidence=0.9), note_factory(confidence=0.7)]
        assert get_avg_confidence(notes) == pytest.approx(0.8)


class TestEmotionalVolatility:
    def test_empty_returns_none(self):
        assert get_emotional_volatility([]) is None

    def test_single_note_returns_none(self, single_note):
        assert get_emotional_volatility([single_note]) is None

    def test_identical_values_zero(self, note_factory):
        notes = [note_factory(intensity=0.5), note_factory(intensity=0.5)]
        assert get_emotional_volatility(notes) == pytest.approx(0.0)

    def test_different_values_positive(self, note_factory):
        notes = [note_factory(intensity=0.2), note_factory(intensity=0.8)]
        assert get_emotional_volatility(notes) > 0


class TestStressRatio:

    def test_no_stress_returns_zero(self):
        assert get_stress_ratio({"joy": 0.7, "calm": 0.3}) == 0.0

    def test_correct_ratio(self):
        assert get_stress_ratio({"stress": 0.4, "joy": 0.6}) == pytest.approx(0.4)

    def test_empty_returns_zero(self):
        assert get_stress_ratio({}) == 0.0


class TestEnergyMetrics:

    def test_avg_energy_empty_returns_none(self):
        assert get_avg_energy([]) is None

    def test_avg_focus_empty_returns_none(self):
        assert get_avg_focus([]) is None

    def test_avg_energy_single(self, note_factory):
        assert get_avg_energy([note_factory(energy=0.7)]) == pytest.approx(0.7)

    def test_avg_energy_multiple(self, note_factory):
        notes = [note_factory(energy=0.4), note_factory(energy=0.6)]
        assert get_avg_energy(notes) == pytest.approx(0.5)

    def test_none_energy_skipped(self, note_factory):
        note = note_factory()
        note["analysis"]["energyLevel"] = None
        assert get_avg_energy([note]) is None

    @pytest.mark.parametrize(
        "daily, threshold, expected",
        [
            ({"2026-02-17": 0.3, "2026-02-18": 0.5, "2026-02-19": 0.2}, 0.4, 2),
            ({"2026-02-17": 0.6, "2026-02-18": 0.7}, 0.4, 0),
            ({}, 0.4, 0),
        ],
    )
    def test_low_energy_days(self, daily, threshold, expected):
        assert get_low_energy_days(daily, threshold) == expected


class TestBurnoutDetection:

    def test_none_energy_returns_false(self):
        assert detect_burnout_risk(0.5, None, 4) is False

    def test_all_conditions_met(self):
        assert detect_burnout_risk(0.5, 0.3, 4) is True

    @pytest.mark.parametrize(
        "stress, energy, days",
        [
            (0.3, 0.3, 4),
            (0.5, 0.5, 4),
            (0.5, 0.3, 1),
        ],
    )
    def test_missing_one_condition(self, stress, energy, days):
        assert detect_burnout_risk(stress, energy, days) is False


class TestTopicMetrics:

    def test_topics_empty(self):
        assert get_top_topics([]) == {}

    def test_topics_counted(self, note_factory):
        notes = [
            note_factory(topics=["work", "deadline"]),
            note_factory(topics=["work"]),
            note_factory(topics=["personal"]),
        ]
        result = get_top_topics(notes, top_n=5)
        assert result["work"] == 2
        assert result["deadline"] == 1

    def test_top_n_respected(self, note_factory):
        note = note_factory(topics=["a", "b", "c", "d", "e"])
        assert len(get_top_topics([note], top_n=3)) == 3

    def test_keywords_empty(self):
        assert get_top_keywords([]) == {}

    def test_keywords_counted(self, note_factory):
        notes = [
            note_factory(keywords=["stress", "work"]),
            note_factory(keywords=["stress"]),
        ]
        kw = get_top_keywords(notes)
        assert kw["stress"] == 2
        assert kw["work"] == 1


class TestTimePatterns:

    def test_empty_returns_zero_count(self):
        result = analyze_time_patterns([])
        assert result["total_notes_analysed"] == 0
        assert result["most_active_session"] is None

    @pytest.mark.parametrize(
        "hour, expected_session",
        [
            (5, "morning"),
            (9, "morning"),
            (11, "morning"),
            (12, "afternoon"),
            (15, "afternoon"),
            (17, "afternoon"),
            (18, "evening"),
            (21, "evening"),
            (22, "night"),
            (23, "night"),
            (0, "night"),
            (4, "night"),
        ],
    )
    def test_session_classification(self, note_factory, hour, expected_session):
        notes = [note_factory(hour=hour), note_factory(hour=hour, day=18)]
        assert analyze_time_patterns(notes)["most_active_session"] == expected_session

    def test_late_night_ratio_zero(self, note_factory):
        notes = [note_factory(hour=10), note_factory(hour=14)]
        assert analyze_time_patterns(notes)["late_night_ratio"] == pytest.approx(0.0)

    def test_late_night_ratio_full(self, note_factory):
        notes = [note_factory(hour=23), note_factory(hour=23, day=18)]
        assert analyze_time_patterns(notes)["late_night_ratio"] == pytest.approx(1.0)

    def test_late_night_ratio_partial(self, note_factory):
        notes = [
            note_factory(hour=23, day=17),
            note_factory(hour=0, day=18),
            note_factory(hour=10, day=19),
            note_factory(hour=14, day=20),
        ]
        assert analyze_time_patterns(notes)["late_night_ratio"] == pytest.approx(0.5)

    def test_correlation_needs_min_two_per_group(self, note_factory):
        notes = [note_factory(hour=23), note_factory(hour=10)]
        assert analyze_time_patterns(notes)["night_stress_correlation"] is None

    def test_correlation_detects_night_stress(self, note_factory):
        notes = [
            note_factory(hour=23, intensity=0.9, energy=0.2, day=17),
            note_factory(hour=0, intensity=0.8, energy=0.3, day=18),
            note_factory(hour=10, intensity=0.3, energy=0.8, day=19),
            note_factory(hour=14, intensity=0.2, energy=0.9, day=20),
        ]
        corr = analyze_time_patterns(notes)["night_stress_correlation"]
        assert corr is not None
        assert corr["late_night_avg_intensity"] > corr["other_avg_intensity"]
        assert corr["late_night_avg_energy"] < corr["other_avg_energy"]

    def test_busiest_day(self, note_factory):
        notes = [note_factory(day=17), note_factory(day=17), note_factory(day=18)]
        result = analyze_time_patterns(notes)
        assert result["busiest_date"] == "2026-02-17"
        assert result["busiest_date_note_count"] == 2

    def test_most_active_weekday(self, note_factory):
        # 2026-02-17 is a Tuesday
        notes = [note_factory(day=17), note_factory(day=17)]
        assert analyze_time_patterns(notes)["most_active_day"] == "Tuesday"

    def test_none_datetime_handled_gracefully(self):
        notes = [{"createdAt": None}, {"createdAt": "bad"}]
        result = analyze_time_patterns(notes)
        assert result["total_notes_analysed"] == 0
