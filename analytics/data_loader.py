"""
Converts validated Note objects into a pandas DataFrame optimized for the
aggregations that follow.

Why pandas:
- Theme aggregation is a one-line groupby instead of a manual loop.
- Emotion trajectories are natural time-series operations.
- Cross-week comparisons (Quiet Shift) are set operations on indexed Series.

The DataFrame uses a flat schema where nested analysis fields are unpacked into
top-level columns. This makes downstream code declarative rather than imperative.
"""

import pandas as pd
from models import Note


def notes_to_dataframe(notes: list[Note]) -> pd.DataFrame:
    """
    Flatten a list of Note objects into a DataFrame.

    Each row is one note. List-typed fields (themes, pattern_signals, keywords)
    stay as Python lists in the cell — aggregators that need them call
    DataFrame.explode() on demand.
    """
    if not notes:
        return _empty_dataframe()
    rows = []
    for note in notes:
        analysis = note.analysis  # may be None
        rows.append(
            {
                "note_id": note.id,
                "title": note.title,
                "summary": note.summary,
                "raw_content": note.raw_content,
                "created_at": note.created_at,
                # Source signals — used by aggregators to decide whether emotion
                "source_type": note.source_type,
                "description": note.description,
                "has_description": bool(note.description and note.description.strip()),
                # Analysis fields (with safe defaults)
                "emotion": analysis.emotion if analysis else None,
                "emotion_intensity": analysis.emotion_intensity if analysis else None,
                "cognitive_type": analysis.cognitive_type if analysis else None,
                "relationship": analysis.relationship if analysis else None,
                "insight_type": analysis.insight_type if analysis else None,
                "themes": analysis.themes if analysis else [],
                "pattern_signals": analysis.pattern_signals if analysis else [],
                "confidence": analysis.confidence if analysis else None,
                # Derived
                "raw_length": len(note.raw_content) if note.raw_content else 0,
            }
        )

    df = pd.DataFrame(rows)

    # Ensure created_at is datetime and sorted
    df["created_at"] = pd.to_datetime(df["created_at"])

    # Replace pandas-introduced NaN in object columns with None.
    # Numeric columns (emotion_intensity, confidence) keep NaN since downstream
    # uses pd.isna() / dropna() / mean() which handle it correctly.
    object_cols = [
        "title",
        "summary",
        "raw_content",
        "description",
        "source_type",
        "emotion",
        "cognitive_type",
        "relationship",
        "insight_type",
    ]
    for col in object_cols:
        if col in df.columns:
            df[col] = df[col].where(df[col].notna(), None)
    df = df.sort_values("created_at").reset_index(drop=True)
    return df


def _empty_dataframe() -> pd.DataFrame:
    """Return an empty DataFrame with the expected columns and dtypes."""
    return pd.DataFrame(
        {
            "note_id": pd.Series(dtype=str),
            "title": pd.Series(dtype=object),
            "summary": pd.Series(dtype=object),
            "raw_content": pd.Series(dtype=str),
            "created_at": pd.Series(dtype="datetime64[ns]"),
            "source_type": pd.Series(dtype=object),
            "description": pd.Series(dtype=object),
            "has_description": pd.Series(dtype=bool),
            "emotion": pd.Series(dtype=object),
            "emotion_intensity": pd.Series(dtype=float),
            "cognitive": pd.Series(dtype=object),
            "relationship": pd.Series(dtype=object),
            "insight_type": pd.Series(dtype=object),
            "themes": pd.Series(dtype=object),
            "pattern_signals": pd.Series(dtype=object),
            "confidence": pd.Series(dtype=float),
            "raw_length": pd.Series(dtype=int),
        }
    )
