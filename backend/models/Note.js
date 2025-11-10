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
        isProcessing: {
            type: Boolean,
            default: true, // true when AI is working
        }
    },
    {
        timestamps: true,
    }
)

//compund index: critical for weekly/monthly report queries
noteSchema.index({ userId: 1, createdAt: -1 })

//index for keyword stats
noteSchema.index({ userId: 1, keywords: 1 })

//index for summary + title lookup in report generation
noteSchema.index({ userId: 1, summary: 1, title: 1 })

export default mongoose.model('Note', noteSchema)