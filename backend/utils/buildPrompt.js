const SUMMARY_MAX_WORDS = 60;

const CATEGORY_INSTRUCTIONS = {
    meeting: `
Meeting note — Organize using clear sections:
- ## Summary
- ## Decisions
- ## Action Items
Format action items as:
- [ ] Task @person (deadline)
Focus on clarity and next steps.
    `,
    study: `
Study note — Organize using:
- ## Main Concepts
- ## Key Insights
- ## Examples or Code Snippets
- ## Summary
Prioritize clarity and logical grouping.
    `,
    interview: `
Interview note — Use:
- ## Candidate Overview
- ## Technical Skills Assessment
- ## Behavioral / Cultural Fit
- ## Key Observations
- ## Final Evaluation & Recommendation
Be objective and professional.
    `,
};

function buildPrompt(note) {
    const categoryInstruction =
        CATEGORY_INSTRUCTIONS[note.category] ||
        CATEGORY_INSTRUCTIONS["meeting"]; // fallback

    return `
You are a professional note-taking assistant. Your task is to read the raw note and produce:

1) A human-readable Markdown version of the content (streamed gradually).
2) A final structured JSON object (NOT streamed) containing the title, content, keywords, and summary.

Follow this **two-phase output protocol strictly**:

==========================
PHASE 1 — STREAMING CONTENT
==========================
Begin by outputting:

<CONTENT>

Inside <CONTENT>, write ONLY the Markdown version of the organized note.
- Stream it gradually in natural order.
- NO JSON in this section.
- NO explanations, no commentary.
- Use headers, bullet points, structure, clarity.

Close this section exactly with:

</CONTENT>

==========================
PHASE 2 — FINAL JSON OBJECT
==========================
After PHASE 1 is fully completed, output:

<FINAL_JSON>
{
  "title": "3–8 word concise title",
  "content": "The complete markdown content from PHASE 1 (escaped as needed)",
  "keywords": ["3 to 6 lowercase keywords"],
  "summary": "1–2 very concise sentences, max ${SUMMARY_MAX_WORDS} words."
}
</FINAL_JSON>

Rules:
- Start streaming the output immediately.
- Do NOT wait to plan, summarize, or generate the final JSON before starting.
- Your FIRST token should belong to the <CONTENT> section.
- Do NOT hold the response to think — stream as you generate.
- The JSON object MUST be valid JSON.
- Do not output anything outside <FINAL_JSON>.
- No markdown, no commentary, no extra words.

==========================
CATEGORY-SPECIFIC INSTRUCTION
==========================
${categoryInstruction.trim()}

==========================
RAW NOTE CONTENT
==========================
"""${note.rawContent.trim()}"""

Begin now.
    `.trim();
}

export default buildPrompt;
