import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['weekly', 'monthly'],
            required: true,
        },
        periodKey: {
            type: String,
            required: true,
            // Format: '2025-W11' or '2025-M03'
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },
        content: {
            type: [String], //Array of encouraging sentences
            default: [],
        },
        poeticLine: {
            type: String,
            default: null, //spotify-style poetic closing
        },
        stats: {
            noteCount: { type: Number, default: 0 },
            activeDays: { type: Number, default: 0 },
            topKeywords: {
                type: [
                    {
                        keyword: String,
                        count: Number,
                    },
                ],
                default: [],
            },
        },
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: 'pending',
        },
        generatedAt: {
            type: Date,
        },
        /**Error message when status === 'failed' */
        errorMessage: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
)

// unique constraint: one report per user per period
reportSchema.index(
    { userId: 1, type: 1, periodKey: 1 },
    { uique: true }
);

//fast lookup by date change
reportSchema.index({ userId: 1, startDate: -1 });

export default mongoose.model('Report', reportSchema);