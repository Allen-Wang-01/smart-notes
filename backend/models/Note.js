import mongoose from 'mongoose'

// =====================================================
// Analysis sub-schema
// Captures LLM-extracted cognitive and emotional signals
// used for Personal Narrative generation and cross-note
// pattern detection.
// =====================================================
const AnalysisSchema = new mongoose.Schema(
    {
        // Free-form emotion description (null if no clear emotion).
        // Example: "uncertain but motivated", "quiet reflection"
        // Not every note carries emotion (e.g. pure technical learning).
        emotion: {
            type: String,
            default: null,
        },

        // Emotion strength (0-1). Null when emotion is null.
        // Used for detecting emotional turning points that
        // trigger Narrative generation.
        emotionIntensity: {
            type: Number,
            min: 0,
            max: 1,
            default: null,
        },

        // High-level nature of the note content.
        cognitiveType: {
            type: String,
            enum: ["knowledge", "skill", "reflection", "action"],
            default: null,
        },

        // Relationship with related notes (detected via vector search).
        relationship: {
            type: String,
            enum: ["evolution", "contradiction", "expansion", "isolated"],
            default: null,
        },

        // Type of LLM response streamed to the user.
        insightType: {
            type: String,
            enum: ["insight", "naming", "reflection"],
            default: null,
        },

        // Free-form theme tags for cross-note aggregation in Narrative.
        // Example: ["career transition", "technical learning"]
        themes: {
            type: [String],
            default: [],
        },

        // Recurring signal words/phrases from this note.
        // Used by Narrative to detect patterns across notes,
        // e.g. "user mentioned 'uncertain' three times this week,
        // each followed by a concrete action".
        patternSignals: {
            type: [String],
            default: [],
        },

        // Overall confidence of the LLM's metadata extraction.
        confidence: {
            type: Number,
            min: 0,
            max: 1,
            default: null,
        },
    },
    { _id: false }
);


// =====================================================
// Note schema
// Primary storage for user-authored knowledge entries.
// Embeddings and cognitive units are stored in
// PostgreSQL (pgvector) and linked via _id.
// =====================================================
const noteSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        // Original user input (never mutated after creation).
        rawContent: {
            type: String,
            required: true,
            trim: true,
        },

        // Source type: distinguishes user-authored content from
        // user-saved external content. This is the primary signal
        // for the LLM to interpret the note correctly.
        //
        // - "authored": the user wrote this themselves; content reflects
        //   their thoughts and emotions.
        // - "saved": the user preserved external material (an article,
        //   an LLM answer, a quote); content reflects what they found
        //   valuable, NOT their emotional state.
        //
        // Defaults to "authored" so existing notes (created before this
        // field existed) remain semantically valid without a backfill.
        sourceType: {
            type: String,
            enum: ["authored", "saved"],
            default: "authored",
            required: true,
        },

        // Optional user-provided description of why this note was saved.
        // When present, this is the highest-trust intent signal in the
        // entire pipeline — higher than sourceType, higher than content.
        description: {
            type: String,
            default: null,
            trim: true,
            maxlength: 300,
        },


        // LLM-streamed insight / naming / reflection shown to the user.
        content: {
            type: String,
            default: null,
        },

        // AI-generated title.
        title: {
            type: String,
            default: null,
        },

        // AI-extracted keywords.
        keywords: {
            type: [String],
            default: [],
        },

        // Structured summary used as context for future related-note
        // retrieval and for MCP responses. Preserves core content,
        // key details, and emotion (when present).
        // Generated in the same LLM call as the streamed content.
        summary: {
            type: String,
            default: null,
            trim: true,
            maxlength: 600,
        },

        // LLM-extracted analytical signals (see AnalysisSchema above).
        analysis: {
            type: AnalysisSchema,
            default: null,
        },

        // ---- Rollback fields (hidden by default) ----
        previousContent: {
            type: String,
            required: false,
            select: false,
        },
        previousTitle: {
            type: String,
            required: false,
            select: false,
        },

        // ---- Job coordination (hidden by default) ----
        generationId: {
            type: String,
            required: false,
            index: true,
            select: false,
        },

        status: {
            type: String,
            enum: ["pending", "processing", "retrying", "completed", "failed"],
            default: "pending",
        },
    },
    {
        timestamps: true,
    }
);


//index for report time period
noteSchema.index({ userId: 1, updatedAt: -1 });

//index for category
noteSchema.index({ userId: 1, category: 1, updatedAt: -1 })

noteSchema.index(
    { userId: 1, keywords: 1 },
    { partialFilterExpression: { keywords: { $exists: true, $ne: [] } } }
);

export default mongoose.model('Note', noteSchema)