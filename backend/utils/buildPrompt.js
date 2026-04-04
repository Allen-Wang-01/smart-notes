const SUMMARY_MAX_WORDS = 60;

const CATEGORY_INSTRUCTIONS = {
    meeting: `
This is a personal meeting recap.

Organize the note into a small number of clear sections that focus on:
- What was discussed
- Key decisions or conclusions
- Action items or follow-ups

Guidelines:
- Keep sections concise
- Prefer bullet points over long paragraphs
- Focus on clarity and usefulness for future review
    `,
    study: `
This is a personal study note.

Organize the note to help future recall and understanding:
- Key concepts learned
- Important insights or takeaways
- Open questions or topics to revisit

Guidelines:
- Group related ideas logically
- Be concise and clear
- Avoid unnecessary repetition
    `,
    interview: `
This is a personal interview reflection.

Organize the note for self-improvement and future preparation:
- What went well
- What was challenging or unclear
- Topics to review or strengthen
- Concrete actions for next time

Guidelines:
- Write from a personal, reflective perspective
- Be constructive and practical
- Keep each section short and focused
    `,
};

function buildPrompt(note) {
    const categoryInstruction =
        CATEGORY_INSTRUCTIONS[note.category] ||
        CATEGORY_INSTRUCTIONS["meeting"]; // fallback

    return `
You are a professional note-organizing assistant.

Your task is to read the raw note and produce a cleaned, well-structured version suitable for long-term personal reference.

The output consists of TWO sections:
1) Final note content streamed directly to the user
2) Metadata for system use only (not streamed)

IMPORTANT RULES FOR NOTE CONTENT:
- First, write the note content (markdown)
- Then, append the metadata block at the very end
- The note content is FINAL end-user content
- Do NOT include protocol descriptions, system markers, or process explanations
- Do NOT include words such as "PART", "PHASE", "SECTION", "METADATA", or references to output structure
- Do NOT include JSON or metadata in the note content
- Do not output <METADATA> anywhere else. It must appear exactly once, at the end

==========================
NOTE CONTENT (STREAMED TO USER)
==========================
- Output ONLY the final organized note content
- Use clear, readable Markdown
- Use a small number of meaningful section headers
- Prefer bullet points and short paragraphs
- Do NOT include any metadata
- Do NOT include JSON
- Do NOT explain what you are doing

This content will be streamed directly to the user and must stand on its own.

==========================
METADATA (SYSTEM USE ONLY)
==========================
After the note content is complete, output the following exactly once:

<METADATA>
{
  "title": "3–8 word concise title",
  "keywords": ["3 to 6 lowercase keywords"],
  "summary": "1–2 concise sentences, maximum ${SUMMARY_MAX_WORDS} words",
  "analysis": {
    "emotionPrimary": "one of: joy | anxiety | calm | stress | sad | anger",
    "emotionIntensity": 0.0,
    "energyLevel": 0.0,
    "focusLevel": 0.0,
    "topics": ["2 to 4 topic strings"],
    "confidence": 0.0
  }
}
</METADATA>

Metadata rules:
- The metadata must be valid JSON
- Do NOT repeat the note content inside the metadata
- Do NOT output anything outside the <METADATA> block
- Do NOT add extra commentary or formatting

Analysis rules:
- The note category is: ${note.category} — use this as context when assessing emotion and energy
- emotionPrimary: the single most dominant emotion reflected in the writing
- emotionIntensity: how strongly that emotion is expressed (0.0–1.0)
- energyLevel: the writer's apparent energy or vitality as reflected in the writing (0.0–1.0)
- focusLevel: how focused or concentrated the writing feels (0.0–1.0)
- topics: 2–4 short strings describing the main subjects discussed
- confidence: your overall confidence in this analysis (0.0–1.0)
- All numeric values must be floats between 0.0 and 1.0
- Do NOT use booleans (true/false) for numeric fields

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
