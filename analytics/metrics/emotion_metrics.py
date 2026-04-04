"""
Calculates emotion-related metrics from a list of note documents.
Each note is expected to be a dict with an 'analysis' sub-dict matching the MongoDb AnalysisSchema.
All averaging functions return None (not 0.0) when the note list is empty, so callers can distinguish "no data"
from "value was zero"
"""

from collections import Counter
from typing import Any


def get_emotion_distribution(notes: list[dict[str, Any]]) -> dict[str, float]:
    """
    Compute the proportion of each primary emotion across all notes.

    Returns a dict mapping emotion label -> ration(0.0 - 1.0)
    sorted descending by frequency
    Return empty dict when there are no notes
    """

    emotions = [
        n["analysis"]["emotionPrimary"]
        for n in notes
        if n.get("analysis") and n["analysis"].get("emotionPrimary")
    ]
    if not emotions:
        return {}

    counts = Counter(emotions)
    total = len(emotions)
    return {emotion: round(count / total, 4) for emotion, count in counts.most_common()}


def get_dominant_emotion(emotion_distribution: dict[str, float]) -> str:
    """
    Return the emotion with the highest ration.
    Return None if no data
    Expects the output of get_emotion_distribution()
    """

    if not emotion_distribution:
        return None
    return max(emotion_distribution, key=emotion_distribution.get)


def get_avg_emotion_intensity(notes: list[dict[str, Any]]) -> float:
    """
    Compute the average emotionIntensity across all notes.
    Return None when no valid values exist
    """

    values = [
        n["analysis"]["emotionIntensity"]
        for n in notes
        if n.get("analysis") and n["analysis"].get("emotionIntensity") is not None
    ]

    if not values:
        return None
    return round(sum(values) / len(values), 4)


def get_avg_confidence(notes: list[dict[str, Any]]) -> float:
    """
    Compute the average analysis confidence score across all notes.
    Returns None when no valid values exist
    """

    values = [
        n["analysis"]["confidence"]
        for n in notes
        if (n.get("analysis") and n["analysis"].get("confidence") is not None)
    ]

    if not values:
        return None
    return round(sum(values) / len(values), 4)


def get_emotional_volatility(notes: list[dict[str, Any]]) -> float:
    """
    Measure emotional volatility as the standard deviation of emotionIntensity.
    Higher values indicate more fluctuating emotional states over the period.
    Returns None when fewer than 2 notes are avaliable
    """

    values = [
        n["analysis"]["emotionIntensity"]
        for n in notes
        if n.get("analysis") and n["analysis"].get("emotionIntensity") is not None
    ]

    if len(values) < 2:
        return None
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return round(variance**0.5, 4)


def get_stress_ratio(emotion_distribution: dict[str, float]) -> float:
    """
    Return the ratio of 'stress' notes.
    Convenience wrapper around emotion_distribution
    """
    return emotion_distribution.get("stress", 0.0)
