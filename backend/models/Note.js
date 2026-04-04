import mongoose from 'mongoose'

const AnalysisSchema = new mongoose.Schema(
    {
        emotionPrimary: {
            type: String,
            enum: ["joy", "anxiety", "calm", "stress", "sad", "anger"],
            required: false,
        },
        emotionIntensity: {
            type: Number,
            min: 0,
            max: 1,
            required: false,
        },
        energyLevel: {
            type: Number,
            min: 0,
            max: 1,
            required: false,
        },
        focusLevel: {
            type: Number,
            min: 0,
            max: 1,
            required: false,
        },
        topics: {
            type: [String],
            required: false,
        },
        confidence: {
            type: Number,
            min: 0,
            max: 1,
            required: false,
        },
    },
    { _id: false }
);

const noteSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        rawContent: {
            type: String,
            required: true,
            trim: true,
        },
        content: {
            type: String,
            default: null, //will be filled by AI
        },
        title: {
            type: String,
            default: null, //AI-generated title
        },
        keywords: {
            type: [String],
            default: [], //AI-extracted keywords
        },
        summary: {
            type: String,
            default: null,
            trim: true,
            maxlength: 300, // Keep token-efficient for reports
        },
        category: {
            type: String,
            enum: ['meeting', 'study', 'interview'],
            default: 'study',
        },
        previousContent: {
            type: String,
            required: false, // used for rollback when regeneration fails
            select: false, // do not return by default

        },
        previousTitle: {
            type: String,
            required: false, // used for rollback title when regeneration fails
            select: false,

        },
        generationId: { // used for job id owns lock
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
        analysis: {
            type: AnalysisSchema,
            required: false,
            default: null,
        },
    },
    {
        timestamps: true,
    }
)


//index for report time period
noteSchema.index({ userId: 1, updatedAt: -1 });

//index for category
noteSchema.index({ userId: 1, category: 1, updatedAt: -1 })

noteSchema.index(
    { userId: 1, keywords: 1 },
    { partialFilterExpression: { keywords: { $exists: true, $ne: [] } } }
);

export default mongoose.model('Note', noteSchema)