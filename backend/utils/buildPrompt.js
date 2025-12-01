const SUMMARY_MAX_WORDS = 60;

function buildPrompt(note) {
    const baseInstruction = `You are a professional note-taking assistant. Your task is to transform the raw note into structured, clean output.

Requirements:
- Generate a concise title (3–8 words max)
- Produce clean Markdown content with proper headers and bullet points
- Extract 3–6 lowercase keywords that best represent the note
- Write a 1–2 sentence summary in ≤ ${SUMMARY_MAX_WORDS} words

Output MUST be VALID JSON only. Do NOT include any explanations, markdown fences, or extra text.`;

    const categoryInstructions = {
        meeting: `This is a MEETING note. Use these sections when relevant:
- ## Summary
- ## Decisions
- ## Action Items → format as "- [ ] Task @person (if mentioned)"
Prioritize clarity, ownership, and deadlines.`,
        study: `This is a STUDY note. Use these sections when relevant:
- ## Main Concepts
- ## Key Insights
- ## Examples / Code Snippets
- ## Summary
Focus on learning clarity and retention.`,
        interview: `This is an INTERVIEW note (you are the interviewer). Use these sections:
- ## Candidate Overview
- ## Technical Skills Assessment
- ## Behavioral / Cultural Fit
- ## Key Observations
- ## Final Evaluation & Recommendation
Be objective, specific, and professional.`
    };

    const specific = categoryInstructions[note.category] || categoryInstructions.meeting;

    return `
${baseInstruction}
${specific}

Raw note content:
"""${note.rawContent.trim()}"""

Respond with EXACTLY this JSON structure and nothing else:
{
  "title": "Brief descriptive title",
  "content": "Full markdown content here (use \\n for line breaks if needed)",
  "keywords": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "summary": "One or two extremely concise sentences. Max ${SUMMARY_MAX_WORDS} words."
}`;
}

export default buildPrompt;