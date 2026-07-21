import mongoose, { Schema } from 'mongoose';

export interface IMcpRefreshToken {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    clientId: string;
    // SHA-256 hex of the raw token — never store the raw value
    tokenHash: string;
    // Space-delimited scope granted at authorization time, so the refresh grant
    // can echo the originally-granted scope instead of a hardcoded default.
    scope?: string;
    expiresAt: Date;
    // Set automatically via { timestamps: { createdAt: true } }
    createdAt: Date;
    lastUsedAt?: Date;
    label?: string;
}

const schema = new Schema<IMcpRefreshToken>(
    {
        userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        clientId:   { type: String, required: true },
        tokenHash:  { type: String, required: true, unique: true },
        scope:      { type: String },
        expiresAt:  { type: Date,   required: true },
        lastUsedAt: { type: Date },
        label:      { type: String },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

// MongoDB TTL index: auto-purges expired token documents
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const McpRefreshToken = mongoose.model<IMcpRefreshToken>('McpRefreshToken', schema);
export default McpRefreshToken;
