"""
Generates a short, varied LLM prompt for periods where the user wrote no notes at all

Design goals
- Token-efficient: no statistics section, no time series, no key moments
Just enough context for the LLM to write a warm, encouraging message
- Varied output: a random "angle" is injected each time so the LLM
doesn't produce the same text on consecutive empty weeks.
The variation comes from the prompt, not from post-processing
"""

import random
from datetime import date
from typing import Any

# Each angle is a short instruction that nudges the LLM toward a differenct
# emotional register or narrative focus. The LLM picks up the cue and
# produces meaningfully different output each time.

_ANGLES = [
    "Focus on the gentle invitation to start — remind the user that even a single sentence counts.",
    "Focus on rest and permission — sometimes not writing is itself a form of self-care.",
    "Focus on curiosity — wonder together with the user what this quiet week might mean.",
    "Focus on a fresh start — frame the blank page as potential, not absence.",
    "Focus on small habits — suggest one tiny, low-friction way to begin noting thoughts.",
    "Focus on normalising — remind the user that everyone has weeks where words don't come.",
    "Focus on the week ahead — gently look forward rather than back at the silent week.",
]


def build_zero_notes_snapshot(
    period: str,
    start_date: date,
    end_date: date,
) -> str:
    """
    Build a minimal LLM prompt for a period with zero notes.

    The prompt is intentionally short to save tokens.
    A random angle is selected each call to ensure output variety.

    Args:
        period:     'daily' | 'weekly' | 'monthly'
        start_date: Start of the reporting window.
        end_date:   End of the reporting window.

    Returns:
        A short plaintext prompt string ready to send to the LLM.
    """

    angle = random.choice(_ANGLES)

    return (
        f"[CONTEXT]\n"
        f"This is a {period} emotional wellness report.\n"
        f"Period: {start_date.isoformat()} to {end_date.isoformat()}\n"
        f"The user did not write any notes this period.\n"
        f"\n"
        f"[YOUR TASK]\n"
        f"Write a short, warm message to the user (3–5 sentences maximum).\n"
        f"Narrative angle: {angle}\n"
        f"Tone: gentle, non-judgmental, human. No statistics. No lists.\n"
        f"Do not mention that you are an AI.\n"
        f"Do not apologise or express concern — keep the tone light and encouraging.\n"
        f"\n"
        f"[POETIC LINE]\n"
        f"Also write one single poetic line (poeticLine).\n"
        f"It should feel like a quiet observation about stillness or waiting —\n"
        f"something understated and imagistic, not motivational.\n"
        f"Example style: 'Even quiet weeks leave their own kind of mark.'\n"
    )
