import mongoose, { Schema } from 'mongoose';

// Dynamically-registered OAuth client (RFC 7591 subset).
// Clients are long-lived, so they live in MongoDB (not Redis). Claude is a
// public client: PKCE is mandatory and NO client_secret is ever issued.
export interface IOAuthClient {
    _id: mongoose.Types.ObjectId;
    clientId: string;
    redirectUris: string[];
    clientName?: string;
    createdAt: Date;
}

const schema = new Schema<IOAuthClient>(
    {
        clientId:     { type: String, required: true, unique: true, index: true },
        redirectUris: { type: [String], required: true },
        clientName:   { type: String },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

const OAuthClient = mongoose.model<IOAuthClient>('OAuthClient', schema);
export default OAuthClient;
