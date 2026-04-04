"""
Tests for aggregation/validator.py.

Coverage strategy
-----------------
- Each primitive helper (_to_float, _clamp, _to_str_list, _parse_datetime)
  is tested in isolation first.
- sanitize_note() is tested field by field.
- sanitize_notes() is tested for batch behaviour.
- Parametrize is used wherever the same rule applies to multiple inputs,
  keeping the test count high without duplicating assertion logic.
"""

import pytest
from datetime import datetime, timezone

from aggregation.validator import (
    _to_float,
    _clamp,
    _to_str_list,
    _parse_datetime,
    sanitize_note,
    sanitize_notes,
    VALID_EMOTIONS,
)


# _to_float
class TestToFloat:

    def test_none_returns_none(self):
        assert _to_float(None) is None

    @pytest.mark.parametrize(
        "value, expected",
        [
            (0, 0.0),
            (1, 1.0),
            (0.75, 0.75),
            ("0.5", 0.5),
            ("1", 1.0),
        ],
    )
    def test_valid_values_converted(self, value, expected):
        assert _to_float(value) == pytest.approx(expected)

    @pytest.mark.parametrize("value", [True, False])
    def test_bool_rejected(self, value):
        """bool is a subclass of int — must be explicitly rejected."""
        assert _to_float(value) is None

    @pytest.mark.parametrize("value", ["high", "low", "", "abc", [], {}])
    def test_non_numeric_returns_none(self, value):
        assert _to_float(value) is None


# _clamp
class TestClamp:

    def test_none_passthrough(self):
        assert _clamp(None) is None

    @pytest.mark.parametrize(
        "value, expected",
        [
            (0.0, 0.0),
            (0.5, 0.5),
            (1.0, 1.0),
        ],
    )
    def test_in_range_unchanged(self, value, expected):
        assert _clamp(value) == pytest.approx(expected)

    @pytest.mark.parametrize(
        "value, expected",
        [
            (1.5, 1.0),
            (2.0, 1.0),
            (99.9, 1.0),
        ],
    )
    def test_above_max_clamped_to_one(self, value, expected):
        assert _clamp(value) == pytest.approx(expected)

    @pytest.mark.parametrize(
        "value, expected",
        [
            (-0.1, 0.0),
            (-1.0, 0.0),
        ],
    )
    def test_below_min_clamped_to_zero(self, value, expected):
        assert _clamp(value) == pytest.approx(expected)


# _to_str_list
class TestToStrList:

    def test_none_returns_empty(self):
        assert _to_str_list(None) == []

    def test_empty_string_returns_empty(self):
        assert _to_str_list("") == []

    def test_bare_string_wrapped_in_list(self):
        assert _to_str_list("work") == ["work"]

    def test_valid_list_passthrough(self):
        assert _to_str_list(["a", "b", "c"]) == ["a", "b", "c"]

    def test_none_items_in_list_filtered(self):
        assert _to_str_list(["a", None, "b"]) == ["a", "b"]

    def test_non_string_items_coerced(self):
        assert _to_str_list([1, 2, 3]) == ["1", "2", "3"]

    def test_whitespace_items_filtered(self):
        assert _to_str_list(["  ", "work", " "]) == ["work"]

    @pytest.mark.parametrize("value", [42, {"a": 1}, 3.14])
    def test_unsupported_types_return_empty(self, value):
        assert _to_str_list(value) == []


# _parse_datetime
class TestParseDatetime:
    def test_none_returns_none(self):
        assert _parse_datetime(None) is None

    def test_aware_datetime_passthrough(self):
        dt = datetime(2026, 2, 17, 10, 0, tzinfo=timezone.utc)
        assert _parse_datetime(dt) == dt

    def test_naive_datetime_gets_utc(self):
        naive = datetime(2026, 2, 17, 10, 0)
        result = _parse_datetime(naive)
        assert result.tzinfo is not None

    def test_iso_string_with_z(self):
        result = _parse_datetime("2026-02-17T10:00:00Z")
        assert result is not None
        assert result.year == 2026
        assert result.month == 2
        assert result.day == 17

    def test_iso_string_with_offset(self):
        result = _parse_datetime("2026-02-17T10:00:00+09:00")
        assert result is not None

    @pytest.mark.parametrize(
        "value",
        [
            "not-a-date",
            "",
            "17/02/2026",
            12345,
            [],
        ],
    )
    def test_invalid_values_return_none(self, value):
        assert _parse_datetime(value) is None


# sanitize_note
class TestSanitizeNote:

    @pytest.fixture
    def base(self, note_factory):
        """A completely clean, valid note."""
        return note_factory()

    # Metadata
    def test_clean_note_has_no_repairs(self, base):
        result = sanitize_note(base)
        assert result["_validation"]["has_repairs"] is False
        assert result["_validation"]["repairs"] == []

    def test_original_dict_not_mutated(self, base):
        sanitize_note(base)
        assert "_validation" not in base

    def test_returns_new_dict(self, base):
        result = sanitize_note(base)
        assert result is not base

    def test_unknown_fields_preserved(self, base):
        """Extra fields from MongoDB (e.g. __v, updatedAt) should pass through."""
        base["__v"] = 0
        base["updatedAt"] = "2026-02-17T11:00:00Z"
        result = sanitize_note(base)
        assert result["__v"] == 0
        assert result["updatedAt"] == "2026-02-17T11:00:00Z"

    # emotionPrimary
    @pytest.mark.parametrize("emotion", sorted(VALID_EMOTIONS))
    def test_all_valid_emotions_preserved(self, base, emotion):
        base["analysis"]["emotionPrimary"] = emotion
        result = sanitize_note(base)
        assert result["analysis"]["emotionPrimary"] == emotion
        assert not result["_validation"]["has_repairs"]

    @pytest.mark.parametrize(
        "bad_emotion", ["happy", "excited", "depressed", "STRESS", "Joy"]
    )
    def test_invalid_emotion_set_to_none(self, base, bad_emotion):
        base["analysis"]["emotionPrimary"] = bad_emotion
        result = sanitize_note(base)
        assert result["analysis"]["emotionPrimary"] is None
        assert result["_validation"]["has_repairs"]

    @pytest.mark.parametrize("missing", [None, "", "  "])
    def test_missing_or_empty_emotion_set_to_none(self, base, missing):
        base["analysis"]["emotionPrimary"] = missing
        result = sanitize_note(base)
        assert result["analysis"]["emotionPrimary"] is None

    # Float fields
    @pytest.mark.parametrize(
        "field", ["emotionIntensity", "energyLevel", "focusLevel", "confidence"]
    )
    def test_valid_float_preserved(self, base, field):
        base["analysis"][field] = 0.7
        result = sanitize_note(base)
        assert result["analysis"][field] == pytest.approx(0.7)

    @pytest.mark.parametrize(
        "field", ["emotionIntensity", "energyLevel", "focusLevel", "confidence"]
    )
    def test_value_above_1_clamped(self, base, field):
        base["analysis"][field] = 1.5
        result = sanitize_note(base)
        assert result["analysis"][field] == pytest.approx(1.0)
        assert result["_validation"]["has_repairs"]

    @pytest.mark.parametrize(
        "field", ["emotionIntensity", "energyLevel", "focusLevel", "confidence"]
    )
    def test_value_below_0_clamped(self, base, field):
        base["analysis"][field] = -0.2
        result = sanitize_note(base)
        assert result["analysis"][field] == pytest.approx(0.0)
        assert result["_validation"]["has_repairs"]

    def test_numeric_string_coerced(self, base):
        base["analysis"]["energyLevel"] = "0.6"
        result = sanitize_note(base)
        assert result["analysis"]["energyLevel"] == pytest.approx(0.6)

    def test_non_numeric_string_becomes_none(self, base):
        base["analysis"]["energyLevel"] = "high"
        result = sanitize_note(base)
        assert result["analysis"]["energyLevel"] is None
        assert result["_validation"]["has_repairs"]

    @pytest.mark.parametrize("field", ["emotionIntensity", "energyLevel"])
    def test_bool_becomes_none(self, base, field):
        base["analysis"][field] = True
        result = sanitize_note(base)
        assert result["analysis"][field] is None

    @pytest.mark.parametrize("field", ["emotionIntensity", "energyLevel"])
    def test_none_float_stays_none(self, base, field):
        base["analysis"][field] = None
        result = sanitize_note(base)
        assert result["analysis"][field] is None
        assert not result["_validation"]["has_repairs"]

    # Missing / null analysis

    def test_missing_analysis_key_does_not_crash(self, base):
        del base["analysis"]
        result = sanitize_note(base)
        assert result["analysis"]["emotionPrimary"] is None
        assert result["analysis"]["energyLevel"] is None
        assert result["_validation"]["has_repairs"]

    def test_null_analysis_does_not_crash(self, base):
        base["analysis"] = None
        result = sanitize_note(base)
        assert isinstance(result["analysis"], dict)

    def test_wrong_type_analysis_does_not_crash(self, base):
        base["analysis"] = "stress"
        result = sanitize_note(base)
        assert isinstance(result["analysis"], dict)
        assert result["_validation"]["has_repairs"]

    # createdAt
    def test_valid_datetime_preserved(self, base):
        dt = datetime(2026, 2, 17, 10, 0, tzinfo=timezone.utc)
        base["createdAt"] = dt
        result = sanitize_note(base)
        assert result["createdAt"] == dt

    def test_iso_string_parsed_to_datetime(self, base):
        base["createdAt"] = "2026-02-17T10:00:00Z"
        result = sanitize_note(base)
        assert isinstance(result["createdAt"], datetime)

    def test_invalid_date_becomes_none_with_repair(self, base):
        base["createdAt"] = "not-a-date"
        result = sanitize_note(base)
        assert result["createdAt"] is None
        assert result["_validation"]["has_repairs"]

    def test_none_createdAt_stays_none_no_repair(self, base):
        base["createdAt"] = None
        result = sanitize_note(base)
        assert result["createdAt"] is None
        # None is an expected value (e.g. note in draft) — not a repair
        assert not result["_validation"]["has_repairs"]

    # String fields
    def test_summary_whitespace_stripped(self, base):
        base["summary"] = "  hello  "
        result = sanitize_note(base)
        assert result["summary"] == "hello"

    def test_none_summary_becomes_empty_string(self, base):
        base["summary"] = None
        result = sanitize_note(base)
        assert result["summary"] == ""

    def test_none_raw_content_becomes_empty_string(self, base):
        base["rawContent"] = None
        result = sanitize_note(base)
        assert result["rawContent"] == ""

    # List fields
    def test_keywords_coerced_from_bare_string(self, base):
        base["keywords"] = "stress"
        result = sanitize_note(base)
        assert result["keywords"] == ["stress"]

    def test_topics_coerced_from_bare_string(self, base):
        base["analysis"]["topics"] = "work"
        result = sanitize_note(base)
        assert result["analysis"]["topics"] == ["work"]
        assert result["_validation"]["has_repairs"]

    def test_topics_none_becomes_empty_list(self, base):
        base["analysis"]["topics"] = None
        result = sanitize_note(base)
        assert result["analysis"]["topics"] == []


# sanitize_notes (batch)
class TestSanitizeNotes:

    def test_empty_list_returns_empty(self):
        assert sanitize_notes([]) == []

    def test_same_length_returned(self, note_factory):
        notes = [note_factory(note_id="n1"), note_factory(note_id="n2")]
        result = sanitize_notes(notes)
        assert len(result) == len(notes)

    def test_all_notes_have_validation_key(self, note_factory):
        notes = [note_factory()]
        result = sanitize_notes(notes)
        assert "_validation" in result[0]

    def test_no_note_silently_dropped(self):
        """Even a completely empty dict should survive sanitisation."""
        result = sanitize_notes([{}])
        assert len(result) == 1

    def test_originals_not_mutated(self, note_factory):
        notes = [note_factory()]
        sanitize_notes(notes)
        assert "_validation" not in notes[0]

    def test_mixed_clean_and_dirty_notes(self, note_factory):
        clean = note_factory(note_id="clean")
        dirty = note_factory(note_id="dirty")
        dirty["analysis"]["energyLevel"] = 2.5  # out of range
        dirty["analysis"]["emotionPrimary"] = "rage"  # invalid

        result = sanitize_notes([clean, dirty])
        assert len(result) == 2
        assert not result[0]["_validation"]["has_repairs"]
        assert result[1]["_validation"]["has_repairs"]
        assert result[1]["analysis"]["energyLevel"] == pytest.approx(1.0)
        assert result[1]["analysis"]["emotionPrimary"] is None
