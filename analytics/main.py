"""
main.py

Entry point demonstrating the report generator pipeline.

Usage:
  1. Fetch completed note documents from MongoDB (filtered by userId and date).
  2. Call build_report() to produce the JSON payload + LLM snapshot.
  3. Send snapshot to your LLM endpoint to generate the emotional report.
"""

import json
import sys
from datetime import date, datetime, timezone

from aggregation.aggregator import build_report


# ── Mock notes (mirrors MongoDB documents after JSON deserialisation) ─────────

MOCK_NOTES = [
    {
        "_id": "note_001",
        "userId": "user_abc",
        "rawContent": "This deadline is killing me, I have no idea how to finish it all, I feel completely broken.",
        "keywords": ["deadline", "work", "pressure"],
        "summary": "User felt overwhelmed by work deadlines.",
        "createdAt": datetime(2026, 2, 17, 23, 15, tzinfo=timezone.utc),  # late night
        "analysis": {
            "emotionPrimary": "stress",
            "emotionIntensity": 0.85,
            "energyLevel": 0.30,
            "focusLevel": 0.45,
            "topics": ["work", "deadline"],
            "confidence": 0.92,
        },
    },
    {
        "_id": "note_002",
        "userId": "user_abc",
        "rawContent": "today's coffee chat with the team was really nice, felt like myself again",
        "keywords": ["team", "coffee", "social"],
        "summary": "Positive team interaction lifted mood.",
        "createdAt": datetime(2026, 2, 18, 14, 30, tzinfo=timezone.utc),  # afternoon
        "analysis": {
            "emotionPrimary": "joy",
            "emotionIntensity": 0.70,
            "energyLevel": 0.65,
            "focusLevel": 0.60,
            "topics": ["social", "team"],
            "confidence": 0.88,
        },
    },
    {
        "_id": "note_003",
        "userId": "user_abc",
        "rawContent": "project review coming up and I haven't prepared enough, can't sleep",
        "keywords": ["project", "review", "stress"],
        "summary": "Anxiety around upcoming project review.",
        "createdAt": datetime(2026, 2, 19, 0, 45, tzinfo=timezone.utc),  # late night
        "analysis": {
            "emotionPrimary": "stress",
            "emotionIntensity": 0.75,
            "energyLevel": 0.38,
            "focusLevel": 0.50,
            "topics": ["work", "project"],
            "confidence": 0.90,
        },
    },
    {
        "_id": "note_004",
        "userId": "user_abc",
        "rawContent": "wrapped up early today, going for a walk, brain finally quiet",
        "keywords": ["calm", "done", "relax"],
        "summary": "User finished work early and felt relaxed.",
        "createdAt": datetime(2026, 2, 20, 17, 0, tzinfo=timezone.utc),  # evening
        "analysis": {
            "emotionPrimary": "calm",
            "emotionIntensity": 0.40,
            "energyLevel": 0.55,
            "focusLevel": 0.65,
            "topics": ["personal", "relaxation"],
            "confidence": 0.85,
        },
    },
]

# Previous period report JSON (as stored in PostgreSQL after last run)
MOCK_PREVIOUS_REPORT: dict = {
    "period": "weekly",
    "time_range": {"start": "2026-02-10", "end": "2026-02-16"},
    "summary": {
        "note_count": 6,
        "dominant_emotion": "calm",
        "emotion_distribution": {"calm": 0.5, "joy": 0.33, "stress": 0.17},
        "avg_emotion_intensity": 0.50,
        "avg_energy": 0.55,
        "avg_focus": 0.62,
        "avg_confidence": 0.82,
        "top_topics": {"work": 3, "personal": 2},
    },
    "time_series": {},
    "trend": {"available": False, "reason": "No previous period report found."},
    "insights": {
        "stress_ratio": 0.17,
        "low_energy_days": 1,
        "burnout_risk": False,
        "emotional_volatility": 0.09,
    },
}


def main() -> None:
    """
    Two scenarios:
      1. Previous report available  → trend deltas populated
      2. No previous report         → trend marked unavailable
    """
    # ── Scenario 1 ────────────────────────────────────────────────────────────
    print("=" * 60)
    print("SCENARIO 1: previous report available")
    print("=" * 60)
    report1 = build_report(
        notes=MOCK_NOTES,
        period="weekly",
        start_date=date(2026, 2, 17),
        end_date=date(2026, 2, 23),
        previous_report=MOCK_PREVIOUS_REPORT,
    )
    report_json_only = {k: v for k, v in report1.items() if k != "snapshot"}
    print(json.dumps(report_json_only, indent=2, ensure_ascii=False))
    print("\n--- SNAPSHOT (sent to LLM) ---\n")
    print(report1["snapshot"])

    # ── Scenario 2 ────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("SCENARIO 2: no previous report")
    print("=" * 60)
    report2 = build_report(
        notes=MOCK_NOTES,
        period="weekly",
        start_date=date(2026, 2, 17),
        end_date=date(2026, 2, 23),
        previous_report=None,
    )
    print("\n--- SNAPSHOT (sent to LLM) ---\n")
    print(report2["snapshot"])

    # ── Scenario 3 ────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("SCENARIO 3: zero notes — varied snapshot each run")
    print("=" * 60)
    report3 = build_report(
        notes=[],
        period="weekly",
        start_date=date(2026, 2, 17),
        end_date=date(2026, 2, 23),
    )
    print(f"note_count : {report3['summary']['note_count']}")
    print(f"avg_energy : {report3['summary']['avg_energy']}")
    print("\n--- SNAPSHOT (sent to LLM) ---\n")
    print(report3["snapshot"])


def run() -> None:
    """
    Subprocess entry point for Node.js worker calls.

    Protocol
    --------
    Input (stdin): single JSON object with keys:
                       notes          list[dict]   — note documents from MongoDB
                       period         str          — 'daily' | 'weekly' | 'monthly'
                       startDate      str          — ISO date, e.g. '2026-02-17'
                       endDate        str          — ISO date, e.g. '2026-02-23'
                       previousReport dict | null  — last period's report JSON, or null

    Output (stdout): single JSON object — the full report dict from build_report()
    On error: { "error": "<message>" }

    Rules
    -----
    - stdout must contain ONLY the JSON result — no print statements anywhere.
    - All logging goes to stderr so it never corrupts the JSON Node.js reads.
    - Exit code 0 on success, 1 on any error.

    """
    try:
        raw = sys.stdin.read()
    except Exception as e:
        json.dump(
            {"error": f"Failed to read stdin: {e}"}, sys.stdout, ensure_ascii=False
        )
        sys.exit(1)

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        json.dump({"error": f"Invalid JSON input: {e}"}, sys.stdout, ensure_ascii=False)
        sys.exit(1)

    # validate required fields
    missing = [
        k for k in ("notes", "period", "startDate", "endDate") if k not in payload
    ]
    if missing:
        json.dump(
            {"error": f"Missing required fields: {missing}"},
            sys.stdout,
            ensure_ascii=False,
        )
        sys.exit(1)

    try:
        start_date = date.fromisoformat(payload["startDate"])
        end_date = date.fromisoformat(payload["endDate"])
    except ValueError as e:
        json.dump(
            {"error": f"Invalid date format: {e}"}, sys.stdout, ensure_ascii=False
        )
        sys.exit(1)

    # Run pipeline
    try:
        report = build_report(
            notes=payload["notes"],
            period=payload["period"],
            start_date=start_date,
            end_date=end_date,
            previous_report=payload.get("previousReport"),
        )
        # default=str handles any non-serialisable types (e. g. date objects)
        json.dump(report, sys.stdout, ensure_ascii=False, default=str)

    except Exception as e:
        print(f"Pipeline error: {e}", file=sys.stderr)
        json.dump({"error": str(e)}, sys.stdout, ensure_ascii=False)
        sys.exit(1)


if __name__ == "__main__":
    if "--demo" in sys.argv:
        main()
    else:
        run()
