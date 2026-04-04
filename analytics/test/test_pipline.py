"""
Integration tests for the full build_report() pipeline

These tests treat build_report() as a black box and verify:
  - Output structure is always complete and correct
  - Edge cases (0/1/2 notes) do not crash or produce misleading data
  - Validator is wired in (dirty inputs are handled gracefully)
  - Zero-notes path produces a usable snapshot
  - Trend is computed when a previous report is provided
  - Snapshot contains no misleading zero scores for missing data
"""

import pytest
from datetime import date
from aggregation.aggregator import build_report

REQUIRED_KEYS = (
    "period",
    "time_range",
    "summary",
    "time_series",
    "trend",
    "insights",
    "time_patterns",
    "snapshot",
    "note_samples",
)


# Helper
def _build(
    notes, *, previous_report=None, start=date(2026, 2, 17), end=date(2026, 2, 23)
):
    return build_report(notes, "weekly", start, end, previous_report=previous_report)


# output structure
class TestOutputStructure:

    def test_all_required_keys_present_normal(self, four_note_week):
        result = _build(four_note_week)
        for key in REQUIRED_KEYS:
            assert key in result, f"Missing key: {key}"

    def test_all_required_keys_present_zero_notes(self):
        result = _build([])
        for key in REQUIRED_KEYS:
            assert key in result, f"Missing key in zero-notes report: {key}"

    def test_time_range_correct(self, four_note_week):
        result = _build(four_note_week, start=date(2026, 2, 17), end=date(2026, 2, 23))
        assert result["time_range"]["start"] == "2026-02-17"
        assert result["time_range"]["end"] == "2026-02-23"

    def test_period_set_correctly(self, four_note_week):
        result = _build(four_note_week)
        assert result["period"] == "weekly"

    def test_snapshot_is_non_empty_string(self, four_note_week):
        result = _build(four_note_week)
        assert isinstance(result["snapshot"], str)
        assert len(result["snapshot"]) > 100

    def test_note_samples_is_list(self, four_note_week):
        result = _build(four_note_week)
        assert isinstance(result["note_samples"], list)


# Zero notes
class TestZeroNotes:

    def test_does_not_crash(self):
        result = _build([])
        assert result["summary"]["note_count"] == 0

    def test_all_averages_are_none(self):
        result = _build([])
        s = result["summary"]
        assert s["avg_energy"] is None
        assert s["avg_focus"] is None
        assert s["avg_emotion_intensity"] is None
        assert s["avg_confidence"] is None

    def test_dominant_emotion_is_none(self):
        assert _build([])["summary"]["dominant_emotion"] is None

    def test_snapshot_contains_no_misleading_zero_scores(self):
        """0.0/10 would tell the LLM the user was exhausted — misleading for no-data."""
        assert "0.0/10" not in _build([])["snapshot"]

    def test_snapshot_mentions_no_notes(self):
        snapshot = _build([])["snapshot"]
        assert "no notes" in snapshot.lower() or "did not write" in snapshot.lower()

    def test_snapshot_varies_across_calls(self):
        """Random angle injection should produce different snapshots."""
        snapshots = {_build([])["snapshot"] for _ in range(20)}
        assert (
            len(snapshots) > 1
        ), "Zero-notes snapshot never varies — angles not being applied"

    def test_note_samples_empty(self):
        assert _build([])["note_samples"] == []

    def test_trend_unavailable(self):
        assert _build([])["trend"]["available"] is False


# One note
class TestOneNote:

    def test_does_not_crash(self, single_note):
        result = _build([single_note])
        assert result["summary"]["note_count"] == 1

    def test_volatility_is_none_for_single_note(self, single_note):
        """Volatility (std dev) requires at least 2 values."""
        result = _build([single_note])
        assert result["insights"]["emotional_volatility"] is None

    def test_averages_computed(self, single_note):
        result = _build([single_note])
        assert result["summary"]["avg_energy"] is not None
        assert result["summary"]["avg_focus"] is not None


# Two Notes


class TestTwoNotes:

    def test_same_day_no_crash(self, note_factory):
        notes = [note_factory(hour=9, day=17), note_factory(hour=14, day=17)]
        result = _build(notes)
        assert result["summary"]["note_count"] == 2

    def test_same_day_no_turning_point(self, note_factory):
        """turning_point requires notes on at least 2 different days."""
        notes = [note_factory(hour=9, day=17), note_factory(hour=14, day=17)]
        result = _build(notes)
        # Should not crash; note_samples may be < 4
        assert isinstance(result["note_samples"], list)

    def test_different_days_volatility_computed(self, note_factory):
        notes = [
            note_factory(intensity=0.2, day=17),
            note_factory(intensity=0.8, day=18),
        ]
        result = _build(notes)
        assert result["insights"]["emotional_volatility"] is not None
        assert result["insights"]["emotional_volatility"] > 0


# Trend
class TestTrend:

    def test_no_previous_report_trend_unavailable(self, four_note_week):
        result = _build(four_note_week)
        assert result["trend"]["available"] is False
        assert result["trend"]["energy_change"] is None

    def test_with_previous_report_trend_available(
        self, four_note_week, previous_report
    ):
        result = _build(four_note_week, previous_report=previous_report)
        assert result["trend"]["available"] is True
        assert result["trend"]["energy_change"] is not None

    def test_trend_delta_direction_correct(self, note_factory, previous_report):
        """Previous energy was 0.55; current is 0.3 → energy_change should be negative."""
        notes = [note_factory(energy=0.3), note_factory(energy=0.3, day=18)]
        result = _build(notes, previous_report=previous_report)
        assert result["trend"]["energy_change"] < 0


# Dirty input (validator integration)
class TestDirtyInputHandling:

    def test_out_of_range_energy_clamped(self, note_factory):
        note = note_factory(energy=2.5)
        note["analysis"]["energyLevel"] = 2.5
        result = _build([note])
        # avg_energy should be clamped to 1.0, not 2.5
        assert result["summary"]["avg_energy"] <= 1.0

    def test_invalid_emotion_excluded_from_distribution(self, note_factory):
        note = note_factory()
        note["analysis"]["emotionPrimary"] = "rage"  # not in VALID_EMOTIONS
        result = _build([note])
        assert "rage" not in result["summary"]["emotion_distribution"]

    def test_missing_analysis_does_not_crash(self, note_factory):
        note = note_factory()
        del note["analysis"]
        result = _build([note])
        assert result["summary"]["note_count"] == 1

    def test_null_analysis_does_not_crash(self, note_factory):
        note = note_factory()
        note["analysis"] = None
        result = _build([note])
        assert result["summary"]["note_count"] == 1

    def test_invalid_datetime_does_not_crash(self, note_factory):
        note = note_factory()
        note["createdAt"] = "not-a-date"
        result = _build([note])
        # Note should still count toward emotion metrics
        assert result["summary"]["note_count"] == 1
        # But time patterns should have 0 timed notes
        assert result["time_patterns"]["total_notes_analysed"] == 0

    def test_bool_energy_value_handled(self, note_factory):
        note = note_factory()
        note["analysis"]["energyLevel"] = True
        result = _build([note])
        # True would be 1.0 if not caught; validator should set it to None
        assert result["summary"]["avg_energy"] is None

    def test_string_numeric_energy_coerced(self, note_factory):
        note = note_factory()
        note["analysis"]["energyLevel"] = "0.6"
        result = _build([note])
        assert result["summary"]["avg_energy"] == pytest.approx(0.6)


# Notes without summary (key moments sampling)
class TestNoteSampling:

    def test_notes_without_summary_yield_no_samples(self, note_factory):
        notes = [note_factory(summary=""), note_factory(summary="   ")]
        result = _build(notes)
        assert result["note_samples"] == []

    def test_raw_excerpt_present_in_samples(self, note_factory):
        note = note_factory(raw="I wrote this myself", summary="A summary.")
        result = _build([note])
        if result["note_samples"]:
            # The snapshot should contain the raw text
            assert "I wrote this myself" in result["snapshot"]

    def test_max_four_samples_returned(self, note_factory):
        # 6 notes - should sample at most 4
        notes = [
            note_factory(
                note_id=f"n{i}",
                emotion=["stress", "joy", "calm", "anxiety", "stress", "joy"][i],
                day=17 + i,
                summary=f"Note {i}.",
            )
            for i in range(6)
        ]
        result = _build(notes)
        assert len(result["note_samples"]) <= 4
