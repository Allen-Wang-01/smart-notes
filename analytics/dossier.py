"""
Dossier construction.

Two outputs:
1. Dossier (structured): persisted as period_reports.report_json - used for
   future cross-week comparisons (next week's Quiet Shift will read this).
2. Prompt (text): the LLM-ready letter brief - Node.js sends this to the LLM.

Design philosophy of the prompt:
- Verbose and redundant — LLMs compress context well.
- Explicit absence — "no data" is stated, not silently omitted, to prevent
  hallucination.
- Grounded — actual user excerpts are quoted so the letter doesn't drift
  into generic platitudes.
- Voice-defining — the prompt instructs the LLM on tone, person, and what
  to avoid (analyzing, advising, summarizing).
- Source-aware — saved content and authored content require different
  framing in the letter. See USING USER DESCRIPTIONS section.
"""

from datetime import datetime
from models import (
    Dossier,
    NarrativeComponents,
    ThemeMap,
    ThemeEvolution,
    HiddenPattern,
    CenterpieceNote,
    QuietShift,
)


def build_dossier(
    components: NarrativeComponents,
    note_count: int,
    is_sparse: bool,
    period: str,
    start_date: str,
    end_date: str,
    stats: dict,
) -> Dossier:
    """Wrap aggregator output in the final Dossier shape."""
    return Dossier(
        period=period,
        start_date=start_date,
        end_date=end_date,
        note_count=note_count,
        is_sparse=is_sparse,
        components=components,
        stats=stats,
    )


def build_prompt(dossier: Dossier) -> str:
    """
    Build the letter-format prompt for the LLM.

    Uses a sectioned dossier-style brief, then explicit voice instructions.
    """
    if dossier.note_count == 0:
        return _build_empty_week_prompt(dossier)

    if dossier.is_sparse:
        return _build_sparse_prompt(dossier)

    return _build_full_prompt(dossier)


# =====================================================
# Variant: empty week
# =====================================================
def _build_empty_week_prompt(dossier: Dossier) -> str:
    """
    Empty-week prompt is a static literal — it does not reference the dossier.
    The `dossier` parameter is kept for signature parity with
    _build_sparse_prompt and _build_full_prompt, and so future iterations
    can read fields like start_date / end_date if a time-aware empty
    message is wanted.
    """
    return """\
You are writing a brief, gentle weekly note to a user who didn't write any notes this week.
 
The user uses a personal reflective system. They write notes when they want to;
this week, they didn't.
 
The frontend will render a salutation ("Dear ...,") and closing
("See you next week.") around your output. You write only the body — one
short paragraph (2-3 sentences), warm but not effusive, in second-person ("you").
 
Do NOT lecture. Do NOT prompt them to write more.
Do NOT include "Dear ...," or "See you next week." or any greeting/sign-off.
 
OUTPUT FORMAT
Return a single JSON object, exactly this shape and nothing else:
 
{
  "paragraphs": ["<your single short paragraph>"]
}
 
- One element only.
- No markdown, no text outside the JSON.
"""


# =====================================================
# Variant: sparse week (1-4 notes)
# =====================================================
def _build_sparse_prompt(dossier: Dossier) -> str:
    sections = []

    sections.append(_voice_instructions())
    sections.append(_dossier_header(dossier))

    if dossier.components.theme_map:
        sections.append(_format_theme_map(dossier.components.theme_map))

    if dossier.components.centerpiece:
        sections.append(_format_centerpiece(dossier.components.centerpiece))

    sections.append(_letter_template(simplified=True))

    return "\n\n".join(sections)


# =====================================================
# Variant: full week
# =====================================================
def _build_full_prompt(dossier: Dossier) -> str:
    sections = []

    sections.append(_voice_instructions())
    sections.append(_dossier_header(dossier))

    if dossier.components.theme_map:
        sections.append(_format_theme_map(dossier.components.theme_map))
    else:
        sections.append("THEME MAP: no themes available.")

    if dossier.components.theme_evolutions:
        sections.append(_format_theme_evolutions(dossier.components.theme_evolutions))
    else:
        sections.append("THEME EVOLUTIONS: no clear evolutions detected this week.")

    if dossier.components.hidden_patterns:
        sections.append(_format_hidden_patterns(dossier.components.hidden_patterns))
    else:
        sections.append("HIDDEN PATTERNS: no recurring patterns detected.")

    if dossier.components.centerpiece:
        sections.append(_format_centerpiece(dossier.components.centerpiece))
    else:
        sections.append("CENTERPIECE NOTE: none qualified this week.")

    if dossier.components.quiet_shifts:
        sections.append(_format_quiet_shifts(dossier.components.quiet_shifts))
    else:
        sections.append(
            "QUIET SHIFTS: no significant shifts detected (or no prior week to compare)."
        )

    sections.append(_letter_template(simplified=False))

    return "\n\n".join(sections)


# =====================================================
# Voice instructions (the most important part of the prompt)
# =====================================================
def _voice_instructions() -> str:
    """
    The LLM's role and tone. Identical for sparse and full weeks — voice
    is the model's persona and should not change based on note volume.
    Per-variant differences (paragraph count, word budget) live in
    _letter_template instead.
    """
    return """\
ROLE
You are writing the body of a personal weekly letter to the user.
You are not an analyst, not a coach, not a therapist.
You are a careful observer who has read everything the user wrote this week,
and now reflects it back to them in a way they cannot see for themselves.
 
VOICE
- Second-person, addressed as "you".
- Quiet, warm, plainspoken. Never effusive.
- Observational, not evaluative. Show, don't judge.
- Write in flowing sentences, not bullet points.
- Specific over abstract. Quote the user's actual words when possible.
- Connect — don't just list. Show how separate moments relate.
 
WHAT TO AVOID
- Do not summarize their notes back to them.
- Do not give advice, suggestions, or "next steps".
- Do not praise effort ("you worked hard this week").
- Do not use therapy-speak ("you're processing X").
- Do not use bullet points, headers, or lists.
- Do not use emojis.
 
USING USER DESCRIPTIONS
The dossier distinguishes two kinds of notes the user keeps:
- "authored" — the user wrote the note themselves. The content IS their voice.
- "saved" — the user preserved external content (an article, a quote, an LLM
  answer, a passage from a book). The content is NOT the user's voice.
 
When a saved note has a description, the description is the user's own
statement of why they kept it — that IS their voice, and it is the most
trustworthy signal in the entire dossier. Quote from descriptions when
you want to ground the letter in the user's intent.
 
When writing about a saved note in the letter:
- Frame it as something the user kept, not something the user said.
  Good: "you saved a passage about X" or "the article you kept this week
        on X stayed with you, as you wrote: '...'"
  Bad:  "you wrote about X" or "you reflected that X..."
- If a description exists, weave it in. The user's reason for saving is
  almost always more interesting than the saved content itself.
- If no description exists, treat the saving itself as the signal. Avoid
  inventing emotions or interpretations the user didn't express.
 
When writing about an authored note:
- The content is the user. Quote them directly.
 
This distinction matters because misattributing saved material to the
user — describing a Murakami quote as "what you wrote" — breaks the trust
of the letter.
 
STRUCTURE
The frontend renders the salutation ("Dear ...,") and a static closing
("See you next week.") around your output. You write ONLY the body.
Do NOT include any greeting or sign-off in your output.
 
The body should read as continuous prose split across paragraphs (the
exact count is specified in the TASK section below). Each paragraph is
a self-contained thought — natural, not topic-sentence-and-support.
 
If you decide an Implicit Question is appropriate (a question the user
didn't ask themselves but the data points toward), include it as one
short paragraph near the end. Phrase it gently — something like
"I've been wondering—" or "I want to ask you—".
Only include the question if it has clear grounding in the dossier.
Do not invent questions to fill space.
"""


# =====================================================
# Dossier section formatters
# =====================================================
def _dossier_header(dossier: Dossier) -> str:
    return f"""\
WEEKLY DOSSIER
Period: {dossier.start_date} → {dossier.end_date}
Total notes this week: {dossier.note_count}
"""


def _format_theme_map(tm: ThemeMap) -> str:
    lines = ["THEME MAP (where the user's attention went this week)"]
    for slice_ in tm.themes:
        intensity = (
            f", avg emotion intensity {slice_.avg_emotion_intensity}"
            if slice_.avg_emotion_intensity is not None
            else ""
        )
        rel = (
            f", dominant relationship: {slice_.dominant_relationship}"
            if slice_.dominant_relationship
            else ""
        )
        lines.append(f"  - {slice_.theme}: {slice_.note_count} note(s){intensity}{rel}")
    if tm.notable_change:
        lines.append(f"\nNotable change: {tm.notable_change}")
    return "\n".join(lines)


def _format_theme_evolutions(evolutions: list[ThemeEvolution]) -> str:
    blocks = ["THEME EVOLUTIONS (how stances shifted within themes)"]
    for ev in evolutions:
        blocks.append(f"\n  Theme: {ev.theme}")
        blocks.append(f"  Relationship breakdown: {ev.relationship_summary}")
        blocks.append("  Trajectory:")
        for point in ev.trajectory:
            date_str = (
                point.date.strftime("%a %b %d")
                if isinstance(point.date, datetime)
                else str(point.date)
            )
            intensity = (
                f" (intensity {point.intensity})" if point.intensity is not None else ""
            )
            blocks.append(f"    - [{date_str}] emotion: {point.emotion}{intensity}")
            blocks.append(f'      excerpt: "{point.note_excerpt}"')
    return "\n".join(blocks)


def _format_hidden_patterns(patterns: list[HiddenPattern]) -> str:
    blocks = ["HIDDEN PATTERNS (recurring sequences across notes)"]
    for p in patterns:
        blocks.append(f"\n  Signal '{p.signal}' appeared {p.occurrence_count} times.")
        if p.co_occurring_signals:
            blocks.append(
                f"  Frequently followed by: {', '.join(p.co_occurring_signals)}"
            )
        if p.example_pairs:
            blocks.append("  Examples:")
            for current_excerpt, next_excerpt in p.example_pairs:
                blocks.append(
                    f"    Note containing '{p.signal}': \"{current_excerpt}\""
                )
                blocks.append(f'    Next note: "{next_excerpt}"')
    return "\n".join(blocks)


def _format_centerpiece(cp: CenterpieceNote) -> str:
    """
    Render the centerpiece with explicit source framing so the LLM knows
    whether to write "you wrote" (authored) or "you saved" (saved).
    """
    date_str = (
        cp.created_at.strftime("%a %b %d, %H:%M")
        if isinstance(cp.created_at, datetime)
        else str(cp.created_at)
    )
    title = f', titled "{cp.title}"' if cp.title else ""

    if cp.source_type == "saved":
        # Saved content: must be framed as something kept, not written.
        if cp.description:
            return f"""\
CENTERPIECE NOTE (the most weighty single moment of the week)
  This is a SAVED piece — content the user preserved, not wrote.
  Saved {date_str}{title}.
  User's description (their own words on why they saved it): "{cp.description}"
  Why chosen: {cp.why_chosen}.
  Excerpt of the saved content: "{cp.excerpt}"
 
  When writing the letter: frame this as something the user KEPT.
  Anchor on the user's description — that is their voice. The excerpt
  is the saved material and may be quoted as such.
"""
        return f"""\
CENTERPIECE NOTE (the most weighty single moment of the week)
  This is a SAVED piece — content the user preserved, not wrote.
  The user did NOT add a description, so we have no stated reason.
  Saved {date_str}{title}.
  Why chosen: {cp.why_chosen}.
  Excerpt of the saved content: "{cp.excerpt}"
 
  When writing the letter: frame this as something the user kept silently.
  Do NOT invent a reason for saving. Do NOT attribute the excerpt's tone
  or feelings to the user. The act of saving without comment is itself
  the only signal — let it stand.
"""

    # Authored: the content is the user's own voice.
    return f"""\
CENTERPIECE NOTE (the most weighty single moment of the week)
  This is an AUTHORED note — the user's own words.
  Written {date_str}{title}.
  Why chosen: {cp.why_chosen}.
  Excerpt: "{cp.excerpt}"
"""


def _format_quiet_shifts(shifts: list[QuietShift]) -> str:
    blocks = ["QUIET SHIFTS (changes the user likely hasn't consciously noticed)"]
    for s in shifts:
        blocks.append(f"\n  - {s.description}")
        if s.evidence:
            for ev in s.evidence:
                blocks.append(f"    · {ev}")
    return "\n".join(blocks)


# =====================================================
# Letter template — the closing instruction to the LLM


# Output shape: a JSON object with a single field `paragraphs`
# (array of strings). One element per paragraph. No salutation,
# no closing line, no headers.
# =====================================================
def _letter_template(simplified: bool) -> str:
    if simplified:
        return """\
TASK
Write the body of a short weekly letter — 1 to 2 short paragraphs total.
Stay grounded in the dossier above. Do not invent details.
 
The frontend will add the salutation ("Dear ...,") and a closing line
("See you next week.") around your output. You write only the body.
 
Do NOT include "Dear ...,". Do NOT include "See you next week."
Do NOT include any greeting or sign-off.
 
OUTPUT FORMAT
Return a single JSON object, exactly this shape and nothing else:
 
{
  "paragraphs": ["<paragraph 1>", "<paragraph 2 (optional)>"]
}
 
- Each element is one paragraph of natural prose. No newlines inside an element.
- 1 to 2 elements total.
- No markdown, no headers, no bullet points.
- No text outside the JSON.
"""
    return """\
TASK
Write the body of this week's letter — 3 to 5 short paragraphs.
Total length across all paragraphs: 180-280 words.
Use only what the dossier provides — never invent details, names, or events.
 
The frontend will add the salutation ("Dear ...,") and a closing line
("See you next week.") around your output. You write only the body.
 
Do NOT include "Dear ...,". Do NOT include "See you next week."
Do NOT include any greeting or sign-off.
 
If you decide an Implicit Question belongs in this letter (per the
USING USER DESCRIPTIONS guidance above on grounding), make it its own
paragraph near the end — usually the second-to-last.
 
OUTPUT FORMAT
Return a single JSON object, exactly this shape and nothing else:
 
{
  "paragraphs": [
    "<paragraph 1>",
    "<paragraph 2>",
    "<paragraph 3>",
    "<paragraph 4 (optional)>",
    "<paragraph 5 (optional)>"
  ]
}
 
- Each element is one paragraph of continuous prose. No newlines inside an element.
- 3 to 5 elements total.
- No markdown, no headers, no bullet points.
- No text outside the JSON — no preamble, no explanation, no code fences.
"""
