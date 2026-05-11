"""
Subprocess entry point for the Narrative pipeline.

Protocol
--------
Input (stdin): single JSON object with keys:
    notes          list[dict]   — note documents from MongoDB
    period         str          — currently only 'weekly'
    startDate      str          — ISO date, e.g. '2026-04-20'
    endDate        str          — ISO date, e.g. '2026-04-26'
    previousReport dict | null  — last week's dossier JSON, or null

Output (stdout): single JSON object with keys:
    dossier        dict         — structured weekly dossier (persist as report_json)
    prompt         str          — LLM-ready prompt; Node calls the LLM with this

On error (any exception): stdout receives { "error": "<message>" }, exit 1.

Rules
-----
- stdout contains ONLY the JSON result. All logs go to stderr.
- Exit 0 on success, 1 on error.
"""

from __future__ import annotations

import json
import sys
import traceback
from typing import Any

from models import PipelineInput, PipelineOutput
from data_loader import notes_to_dataframe
from aggregators.component_selector import select_components
from dossier import build_dossier, build_prompt


def _log(message: str) -> None:
    """Stderr-only logging — never pollutes stdout."""
    print(message, file=sys.stderr, flush=True)


def run(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Pure function — easy to unit test.

    Input: the raw JSON dict from Node.
    Output: the dict that will be JSON-serialized to stdout.
    """
    parsed = PipelineInput.model_validate(payload)

    df = notes_to_dataframe(parsed.notes)

    components, is_sparse = select_components(df, parsed.previous_report)

    stats = _build_stats(df)

    dossier = build_dossier(
        components=components,
        note_count=len(df),
        is_sparse=is_sparse,
        period=parsed.period,
        start_date=parsed.start_date,
        end_date=parsed.end_date,
        stats=stats,
    )

    prompt = build_prompt(dossier)

    output = PipelineOutput(dossier=dossier, prompt=prompt)
    return output.model_dump(mode="json")


def _build_stats(df) -> dict[str, Any]:
    """Lightweight stats for debugging — appears in dossier.stats."""
    if df.empty:
        return {"note_count": 0}

    return {
        "note_count": int(len(df)),
        "avg_raw_length": float(df["raw_length"].mean()),
        "notes_with_emotion": int(df["emotion"].notna().sum()),
        "cognitive_type_breakdown": (
            df["cognitive_type"].dropna().value_counts().to_dict()
        ),
    }


def main() -> None:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print(json.dumps({"error": "empty stdin"}))
            sys.exit(1)

        payload = json.loads(raw)
        result = run(payload)
        sys.stdout.write(json.dumps(result, default=str))
        sys.stdout.flush()
        sys.exit(0)

    except Exception as e:
        _log(f"Pipeline failed: {e}")
        _log(traceback.format_exc())
        sys.stdout.write(json.dumps({"error": str(e)}))
        sys.stdout.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
