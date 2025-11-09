function buildPrompt(note) {
    const baseInstruction = `
You are a professional note organizer. Transform the user's raw note into:
1. A clean, structured Markdown content
2. A concise title (max 8 words)
3. 3–6 keywords
`;

    const categoryPrompts = {
        meeting: `
This is a *meeting note*. Organize it into sections like:
- **Summary**
- **Decisions**
- **Action Items**
Use clear bullet points, concise sentences, and maintain professional tone.
`,
        study: `
This is a *study note*. Structure it into sections like:
- **Main Concepts**
- **Key Insights**
- **Examples or Applications**
- **Summary**
Emphasize clarity and educational readability.
`,
        interview: `
This is an *interview note*. Structure it into sections like:
- **Candidate Overview**
- **Technical Skills**
- **Behavioral Notes**
- **Final Evaluation**
Use concise, objective tone and emphasize key takeaways.
`
    };

    const categoryHint = categoryPrompts[note.category] || "";

    return `
${baseInstruction}
${categoryHint}

Raw note:
"""
${note.rawContent}
"""

Respond strictly in JSON format:
{
  "title": "string",
  "content": "markdown string",
  "keywords": ["string"]
}
`;
}

export default buildPrompt;