import mongoose from 'mongoose'

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
            default: null, // used for rollback when regeneration fails
        },
        previousTitle: {
            type: String,
            default: null, // used for rollback title when regeneration fails
        },
        isProcessing: {
            type: Boolean,
            default: true, // true when AI is working
        }
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