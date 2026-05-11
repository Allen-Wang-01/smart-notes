"""
Hidden Pattern: detects recurring patternSignals across notes and surfaces
likely cause-effect or sequential patterns the user may not consciously see.

Example: 'uncertain' appears 3 times, and each time the *next* note contains
'decision' or 'tomorrow' — surface this as "uncertainty → action" pattern.

Implementation:
- Uses itertools.pairwise to walk consecutive note pairs in time order.
- Counter for frequency analysis.
- Pure functional style — easy to read and easy to test.
"""

from collections import Counter, defaultdict
from itertools import pairwise
import pandas as pd

from models import HiddenPattern

# A signal must appear in at least this many notes to be a "pattern."
MIN_OCCURRENCES = 3

# a co-occurring signal must follow at least this many times to be reported.
MIN_CO_OCCURRENCES = 2

# How many distinct patterns to surface per week.
MAX_PATTERNS = 2

# Excerpt length for grounding examples.
EXCERPT_CHARS = 100


def build_hidden_patterns(df: pd.DataFrame) -> list[HiddenPattern]:
    """
    Detect patterns in two stages:
    1. Find any pattern signal that recurs >= MIN_OCCURRENCES times.
    2. For each, find what signals tend to follow it in adjacent notes.
    """
    if df.empty or len(df) < 2:
        return []

    # Stage 1: signal frequency across all notes
    all_signals = df["pattern_signals"].explode().dropna()
    if all_signals.empty:
        return []

    signal_counts = Counter(all_signals)
    recurring = {
        sig: count for sig, count in signal_counts.items() if count >= MIN_OCCURRENCES
    }
    if not recurring:
        return []

    # Stage 2: for each recurring signal, look at what follows
    patterns: list[HiddenPattern] = []

    sorted_df = df.sort_values("created_at").reset_index(drop=True)

    for signal, count in sorted(recurring.items(), key=lambda kv: -kv[1]):
        co_occurring, examples = _find_following_signals(sorted_df, signal)

        # A pattern is only interesting if there's a consistent follow-up
        if not co_occurring:
            continue

        patterns.append(
            HiddenPattern(
                signal=signal,
                occurrence_count=count,
                co_occurring_signals=co_occurring,
                example_pairs=examples,
            )
        )

        if len(patterns) >= MAX_PATTERNS:
            break

    return patterns


# ----- helpers -----


def _find_following_signals(
    sorted_df: pd.DataFrame, signal: str
) -> tuple[list[str], list[tuple[str, str]]]:
    """
    For a given signal, walk through consecutive note pairs and tally what
    signals appear in the *next* note when `signal` appears in the current one.

    Returns:
        (co_occurring_signal_names, example_pairs)
    """
    follower_counts: Counter = Counter()
    example_buffer: list[tuple[str, str]] = []

    rows = sorted_df.to_dict("records")

    # itertools.pairwise gives (row_i, row_{i + 1}) for all consecutive pairs
    for current, nxt in pairwise(rows):
        current_signals = current.get("pattern_signals") or []
        if signal not in current_signals:
            continue

        next_signals = nxt.get("pattern_signals") or []
        for s in next_signals:
            follower_counts[s] += 1

        # Capture an example pair for grounding
        if len(example_buffer) < 3:
            example_buffer.append(
                (
                    _excerpt(current),
                    _excerpt(nxt),
                )
            )

    # Filter followers by minimum co-occurrence
    significant_followers = [
        sig
        for sig, n in follower_counts.most_common()
        if n >= MIN_CO_OCCURRENCES and sig != signal
    ]

    return significant_followers, example_buffer


def _excerpt(row: dict) -> str:
    text = row.get("summary") or row.get("raw_content") or ""
    return (text or "")[:EXCERPT_CHARS].strip()
