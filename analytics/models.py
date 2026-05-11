"""
Pydantic models defining all data shapes flowing through the Narrative pipeline.

Why Pydantic:
- Runtime validation of MongoDB documents (which are loosely typed)
- Self-documenting data contracts between modules
- Automatic JSON serialization for the stdout protocol
- IDE autocomplete and type checking support

These models intentionally mirror the MongoDB Note schema (analysis sub-document)
so we can validate input from Node.js subprocess at the boundary, then work with
strongly-typed objects throughout the pipeline.
"""

from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

# =====================================================
# Input models — mirror MongoDB Note schema
# =====================================================


class NoteAnalysis(BaseModel):
    """Mirrors the analysis sub-document on each Note."""

    model_config = ConfigDict(extra="ignore")  # Tolerate extra fields from Mongo
    emotion: Optional[str] = None
    emotion_intensity: Optional[float] = Field(default=None, alias="emotionIntensity")
    cognitive_type: Optional[str] = Field(default=None, alias="cognitiveType")
    relationship: Optional[str] = None
    insight_type: Optional[str] = Field(default=None, alias="insightType")
    themes: list[str] = Field(default_factory=list)
    pattern_signals: list[str] = Field(default_factory=list, alias="patternSignals")
    confidence: Optional[float] = None


class Note(BaseModel):
    """A single user note as passed in from Node.js."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str = Field(alias="_id")
    user_id: str = Field(alias="userId")
    raw_content: str = Field(alias="rawContent")
    title: Optional[str] = None
    summary: Optional[str] = None
    keywords: list[str] = Field(default_factory=list)
    analysis: Optional[NoteAnalysis] = None
    created_at: datetime = Field(alias="createdAt")

    # Source signals — drive the trust hierarchy used throughout the pipeline.
    # See aggregators/centerpiece.py and dossier.py for how these flow into
    # the final letter prompt.
    #
    # source_type defaults to "authored" so notes that predate this field
    # remain semantically valid without a backfill.
    source_type: Literal["authored", "saved"] = Field(
        default="authored", alias="sourceType"
    )
    description: Optional[str] = None


class PipelineInput(BaseModel):
    """Top-level input from Node.js subprocess."""

    model_config = ConfigDict(extra="ignore")

    notes: list[Note]
    period: Literal["weekly"]  # Monthly removed; daily not supported in this version
    start_date: str = Field(alias="startDate")
    end_date: str = Field(alias="endDate")
    previous_report: Optional[dict] = Field(default=None, alias="previousReport")


# =====================================================
# Aggregation outputs — produced by aggregators/*.py
# =====================================================
class ThemeSlice(BaseModel):
    """One theme's slice of the user's attention this week."""

    theme: str
    note_count: int
    note_ids: list[str]
    avg_emotion_intensity: Optional[float] = None
    dominant_relationship: Optional[str] = None  # evolution / contradiction / ...


class ThemeMap(BaseModel):
    """Component: how the user's attention was distributed this week."""

    total_notes: int
    themes: list[ThemeSlice]
    notable_change: Optional[str] = (
        None  # e.g. "first time technical learning entered top 3"
    )


class EmotionPoint(BaseModel):
    """A single point in an emotion trajectory."""

    date: datetime
    emotion: str
    intensity: Optional[float] = None
    note_excerpt: str  # short excerpt for grounding the LLM


class ThemeEvolution(BaseModel):
    """Component: how the user's stance on a theme evolved through the week."""

    theme: str
    trajectory: list[EmotionPoint]
    relationship_summary: dict[str, int]  # e.g. {"evolution": 3, "contradiction": 1}


class HiddenPattern(BaseModel):
    """Component: a recurring pattern the user likely hasn't noticed."""

    signal: str  # the recurring phrase/concept
    occurrence_count: int
    co_occurring_signals: list[str]  # signals that frequently follow `signal`
    example_pairs: list[
        tuple[str, str]
    ]  # (note_excerpt_with_signal, next_note_excerpt)


class CenterpieceNote(BaseModel):
    """Component: the single most weighty note of the week."""

    note_id: str
    title: Optional[str] = None
    created_at: datetime
    excerpt: str
    why_chosen: str  # human-readable reason, e.g. "longest reflection of the week"
    source_type: Literal["authored", "saved"] = "authored"
    description: Optional[str] = None


class QuietShift(BaseModel):
    """Component: a change the user hasn't consciously noticed."""

    description: str  # e.g. "you stopped mentioning 'Tokyo job' four weeks ago"
    evidence: list[str]


class ImplicitQuestion(BaseModel):
    """Component: a question the user didn't ask themselves."""

    question: str
    grounded_in: list[str]  # note IDs or signals that prompted this question


class NarrativeComponents(BaseModel):
    """All possible components. Any subset may be present per week."""

    theme_map: Optional[ThemeMap] = None
    theme_evolutions: list[ThemeEvolution] = Field(default_factory=list)
    hidden_patterns: list[HiddenPattern] = Field(default_factory=list)
    centerpiece: Optional[CenterpieceNote] = None
    quiet_shifts: list[QuietShift] = Field(default_factory=list)
    implicit_questions: list[ImplicitQuestion] = Field(default_factory=list)


# =====================================================
# Final output — sent back to Node.js via stdout
# =====================================================


class Dossier(BaseModel):
    """Structured weekly dossier. Persisted as period_reports.report_json."""

    period: str
    start_date: str
    end_date: str
    note_count: int
    is_sparse: (
        bool  # True if data is below threshold — Node.js renders simplified narrative
    )
    components: NarrativeComponents
    stats: dict  # Free-form stats for debugging / future use


class PipelineOutput(BaseModel):
    """Final stdout payload."""

    dossier: Dossier
    prompt: str  # The prompt Node.js will send to the LLM
