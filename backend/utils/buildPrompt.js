/**
 * Build the prompt for the LLM.
 *
 * The prompt is structured around THREE signal sources, in order of trust:
 *   1. description (highest, when present) — user's own statement of intent
 *   2. sourceType (medium, always present) — authored vs. saved
 *   3. content (lowest for intent) — rich for themes, unreliable for intent
 *
 * The LLM is instructed to apply this hierarchy when extracting emotion,
 * cognitive type, and cognitive units. The same hierarchy is also applied
 * when reading related notes — each related note carries its own
 * sourceType / description so cross-note reasoning stays consistent.
 *
 * @param {Object} params
 * @param {Object} params.currentNote - The new note. Must include
 *   rawContent, sourceType, and description (description may be null).
 * @param {Array}  params.relatedNotes - Notes returned from vector search.
 *   Each: { note: { rawContent, summary, createdAt, analysis,
 *                   sourceType, description }, similarity }
 * @returns {string}
 */

export function buildPrompt({ currentNote, relatedNotes = [] }) {
  const relatedText = relatedNotes.length
    ? relatedNotes
      .map((item, i) => {
        const n = item.note;
        const time = formatRelativeTime(n.createdAt);
        // Default to "authored" for legacy notes without sourceType.
        const sourceMarker = n.sourceType === 'saved' ? '[saved]' : '[authored]';
        const desc = n.description
          ? `Description: "${n.description}"\n`
          : '';
        // Prefer summary if available (richer semantic signal).
        // Fall back to rawContent for legacy notes without summary.
        const body = n.summary || n.rawContent || '';
        return `(${i + 1}) [${time}] (similarity: ${item.similarity.toFixed(2)})\n${body}`;
      })
      .join('\n\n')
    : 'None';

  const sourceTypeLabel = currentNote.sourceType === 'saved'
    ? 'saved (external content the user chose to preserve)'
    : 'authored (the user wrote this themselves)';

  const descriptionBlock = currentNote.description
    ? `User's description of why they saved this:\n"${currentNote.description}"\n\nThis description is the user's explicit statement of intent. Treat it as the highest-priority signal.\n`
    : `User did not provide a description.\n`;

  return `
You are a system that models a user's cognitive evolution over time.
The user only saves content they consider meaningful and worth preserving.
Do NOT perform noise filtering. Do NOT summarize for the sake of summarizing.
Your job is to interpret, not to describe.

--------------------------------
 
THREE SIGNAL SOURCES (in order of trust)
 
You will receive THREE pieces of information about this note. They are not equally trustworthy.
 
1. DESCRIPTION (highest trust, when present)
   The user's own statement of why they saved this.
   When present, weight this heavily for cognitive_units, themes, and intent.
 
2. SOURCE TYPE (medium trust, always present)
   - "authored": the user wrote this themselves. Content reflects their thoughts,
     emotions, and direct experience. Treat emotion and reflection signals as the user's own.
   - "saved": the user preserved external content (an article, an LLM answer,
     a quote, a recipe). Content reflects what they found valuable, NOT their own
     emotional state. DO NOT extract the user's emotion from the content text itself.
     Cognitive units may capture "user finds this valuable" with confidence ≤ 0.6.
 
3. CONTENT (lowest trust for intent)
   The raw saved material. Always rich for THEMES (what topic this is about),
   but unreliable for INTENT (why the user saved it) without the above two signals.
 
--------------------------------

--------------------------------
 
CRITICAL RULES BASED ON SOURCE TYPE
 
If sourceType is "saved" and no description is provided:
  - DO NOT extract emotion from the content. Set emotion = null, emotionIntensity = null.
  - cognitiveType should be "knowledge" — NOT "reflection".
  - cognitive_units should describe what the user finds valuable, not what they think.
  - Confidence on inferred intent should not exceed 0.5.
 
If sourceType is "authored":
  - Extract emotion freely; the content expresses the user.
  - cognitiveType can be "reflection", "action", "skill", or "knowledge".
  - cognitive_units may include intent inferred from the user's own words.
 
If description is provided:
  - The description's stated intent overrides any inference from content.
  - Use the description's language in cognitive_units when natural.
  - Confidence on intent can rise to 0.7-0.85 (still below explicit content claims).
 
--------------------------------

--------------------------------
 
CONTEXT STATE:
 
Related notes are retrieved via semantic similarity search.
They may be:
 
1. EMPTY (new user or first note, or no semantically close notes exist)
2. WEAKLY RELATED (similarity below ~0.80)
3. STRONGLY RELATED (similarity 0.80+, meaningful connection likely)
 
Apply the same trust hierarchy when reading related notes — each carries
its own [authored] / [saved] marker and may carry its own description.
 
IF related notes are EMPTY:
  - Do NOT fabricate connections.
  - Focus on interpreting the current note on its own terms.
  - Preferred output: naming or reflection.
 
IF related notes are WEAKLY RELATED:
  - Treat them as background context only.
  - Insight only if the connection is genuinely meaningful, not merely topical overlap.
 
IF related notes are STRONGLY RELATED:
  - Use full cross-time reasoning.
  - Look for evolution, contradiction, or expansion of prior thinking.
  - Insight is preferred.
 
--------------------------------
 
CURRENT NOTE:
Source type: ${sourceTypeLabel}
 
${descriptionBlock}
Content:
${currentNote.rawContent}
 
--------------------------------
 
RELATED NOTES:
${relatedText}
 
--------------------------------
 
STEP 1 — CLASSIFY COGNITIVE TYPE
Choose one:
  - knowledge   (external information the user wants to remember)
  - skill       (how-to, technique, structured learning)
  - reflection  (personal thoughts, emotional processing, interpretation)
  - action      (plans, decisions, execution intent)
 
STEP 2 — DETECT RELATIONSHIP WITH RELATED NOTES
Choose one:
  - evolution     (same idea becoming more concrete or refined)
  - contradiction (shift or reversal in thinking)
  - expansion    (adds a new dimension to an existing theme)
  - isolated     (no meaningful connection)
 
STEP 3 — GENERATE CONTENT (the part streamed to the user)
Choose the form:
  - insight    (a cross-time connection the user hasn't noticed)
  - naming     (a conceptual abstraction of what they just wrote)
  - reflection (a state description, useful when emotional content is primary)
 
Content rules:
  - 100-150 words
  - Interpretive, not descriptive
  - Must give the user a perspective they didn't already have
  - Do NOT summarize their note back to them
  - For "saved" notes: do NOT pretend the content is the user's own words.
    Frame insights as "what your saving reveals" rather than "what you wrote".
 
STEP 4 — GENERATE METADATA
A structured JSON object with the following fields.
 
SUMMARY RULES:
  - 100-150 words
  - For "authored": capture content + emotion (if present) + key details
  - For "saved" + description: capture content + the user's stated reason
  - For "saved" without description: capture content + note that the user found this valuable
  - Do NOT include the date — it is added by the system
  - This summary will be reused later as context for related-note retrieval and
    for an MCP-exposed knowledge layer, so preserve signal over style
 
COGNITIVE UNITS RULES:
  - Extract 1-5 structured units representing skills, goals, experiences, beliefs,
    preferences, or values revealed by this note
  - Each unit must carry CONTEXT — not just a label
    BAD:  { "concept": "Node.js", "context": "backend" }
    GOOD: { "concept": "Node.js", "context": "used for BullMQ queue processing
            and SSE streaming in a personal knowledge system" }
  - Confidence reflects how strongly this note reveals the unit (0-1)
  - For each unit, include the user's relationship to the concept, not just the concept
  - For "saved" notes: confidence ≤ 0.6 unless description explicitly confirms
  - For "authored" with intent expressed: confidence 0.7-0.9
  - When inferring intent (vs explicit), prefer tags like ["intent", "learning_focus", "interest"]
  - tags are free-form, 1-3 per unit (e.g. ["backend", "skill"], ["goal", "career"])
  - If the note is a one-off reference with no lasting cognitive signal (e.g. a
    saved recipe the user has no stake in), cognitive_units may be empty.
 
--------------------------------
 
OUTPUT FORMAT (exactly as shown, no extra text outside the tags):
 
<CONTENT>
[your 100-150 word insight / naming / reflection]
</CONTENT>
 
<METADATA>
{
  "title": "short descriptive title",
  "keywords": ["3-6 keywords"],
  "summary": "100-150 word structured summary",
  "cognitiveType": "knowledge | skill | reflection | action",
  "relationship": "evolution | contradiction | expansion | isolated",
  "insightType": "insight | naming | reflection",
  "emotion": "free-form description or null",
  "emotionIntensity": 0.0,
  "themes": ["1-3 theme tags"],
  "patternSignals": ["recurring phrases or concepts from this note"],
  "confidence": 0.0,
  "cognitiveUnits": [
    {
      "concept": "...",
      "context": "...",
      "tags": ["..."],
      "confidence": 0.0
    }
  ]
}
</METADATA>
`;
}

function formatRelativeTime(date) {
  const now = new Date();
  const diff = now - new Date(date);

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;

  return `${Math.floor(days / 365)} years ago`;
}

export default buildPrompt;
