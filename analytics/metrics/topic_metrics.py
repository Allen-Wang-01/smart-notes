from collections import Counter
from typing import Any


def get_top_topics(notes: list[dict[str, Any]], top_n: int = 5) -> dict[str, int]:
    """
    Count occurrences of each topic found in analysis. topics across all notes

    Args:
        notes: List of note dicts.
        top_n: Number of top topics to return

    Returns:
        Dict mapping topic string -> count, limited to top_n entries.
    """

    all_topics: list[str] = []
    for note in notes:
        topics = note.get("analysis", {}).get("topics", [])
        all_topics.extend(topics)

    counter = Counter(all_topics)
    return dict(counter.most_common(top_n))


def get_top_keywords(notes: list[dict[str, Any]], top_n: int = 3) -> dict[str, int]:
    """
    Count occurrences of each keyword extracted from note.keywords across all notes

    Args:
        notes: List of note dicts.
        top_n: Number of top keywords to return
    Returns:
    Dict mapping keyword string -> count, limited to top_n entries
    """

    all_keywords: list[str] = []
    for note in notes:
        keywords = note.get("keywords", [])
        all_keywords.extend(keywords)
    counter = Counter(all_keywords)
    return dict(counter.most_common(top_n))
