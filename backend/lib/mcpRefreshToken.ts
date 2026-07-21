import mongoose from 'mongoose';
import McpRefreshToken, { type IMcpRefreshToken } from '../models/McpRefreshToken.js';
import { hashRefreshToken, verifyRefreshToken } from './refreshTokenHash.js';

// TODO: add integration tests for these helpers once in-memory MongoDB is
// available (skipped due to Node version incompatibility with mongodb-memory-server).

/**
 * Hash rawToken and persist a NEW refresh token document. Used when a
 * connection is first established (authorization_code grant). Each user may
 * have multiple tokens — one per connected Claude session.
 *
 * `scope` records what was granted so a later refresh can echo it back.
 * A freshly-created token has no `lastUsedAt` until it is first refreshed
 * (see rotateToken).
 */
export async function storeToken({
    userId,
    clientId,
    rawToken,
    expiresAt,
    scope,
    label,
}: {
    userId: string | mongoose.Types.ObjectId;
    clientId: string;
    rawToken: string;
    expiresAt: Date;
    scope?: string;
    label?: string;
}): Promise<IMcpRefreshToken> {
    const tokenHash = hashRefreshToken(rawToken);
    return McpRefreshToken.create({ userId, clientId, tokenHash, expiresAt, scope, label });
}

/**
 * Rotate a refresh token IN PLACE: replace the old hash with the new one, stamp
 * lastUsedAt = now, and extend expiresAt — all in a single updateOne, matched on
 * the old hash. This preserves the record's original createdAt, so createdAt
 * means "connection established" and lastUsedAt means "last activity".
 *
 * Matching on the old hash also makes rotation atomically single-use: a
 * concurrent refresh that already rotated this record matches 0 documents, so
 * modifiedCount is 0 and the caller rejects the reused token. Returns true only
 * when exactly one record was rotated.
 */
export async function rotateToken({
    oldTokenHash,
    newRawToken,
    expiresAt,
}: {
    oldTokenHash: string;
    newRawToken: string;
    expiresAt: Date;
}): Promise<boolean> {
    const newTokenHash = hashRefreshToken(newRawToken);
    const result = await McpRefreshToken.updateOne(
        { tokenHash: oldTokenHash },
        { $set: { tokenHash: newTokenHash, lastUsedAt: new Date(), expiresAt } },
    ).exec();
    return result.modifiedCount === 1;
}

/**
 * Look up a non-expired token by userId + SHA-256(rawToken), then confirm the
 * hash in constant time. Returns the document or null.
 */
export async function findAndVerifyToken({
    userId,
    rawToken,
}: {
    userId: string | mongoose.Types.ObjectId;
    rawToken: string;
}): Promise<IMcpRefreshToken | null> {
    const tokenHash = hashRefreshToken(rawToken);
    const doc = await McpRefreshToken.findOne({
        userId,
        tokenHash,
        expiresAt: { $gt: new Date() },
    }).exec();
    if (!doc) return null;
    // Constant-time comparison — belt-and-suspenders against hash collisions
    if (!verifyRefreshToken(rawToken, doc.tokenHash)) return null;
    return doc;
}

/**
 * Revoke a single token by its stored hash.
 * Call this after rotation or when a session is explicitly closed.
 */
export async function revokeToken(tokenHash: string): Promise<void> {
    await McpRefreshToken.deleteOne({ tokenHash }).exec();
}

/**
 * Revoke ALL tokens for a user.
 * Powers "disconnect Claude from my account" / account compromise recovery.
 * Returns the number of connections revoked.
 */
export async function revokeAllTokensForUser(
    userId: string | mongoose.Types.ObjectId
): Promise<number> {
    const result = await McpRefreshToken.deleteMany({ userId }).exec();
    return result.deletedCount ?? 0;
}

// A single active MCP connection, safe to expose to a logged-in user's UI.
// tokenHash is deliberately NEVER included.
export interface McpConnection {
    id: string;
    clientId: string;
    scope?: string;
    label?: string;
    createdAt: Date;
    lastUsedAt?: Date;
}

/**
 * List a user's active MCP connections for the account settings UI.
 * Selects only display fields — the token hash is never projected or returned.
 */
export async function listConnectionsForUser(
    userId: string | mongoose.Types.ObjectId
): Promise<McpConnection[]> {
    const docs = await McpRefreshToken.find({ userId })
        .select('clientId scope label createdAt lastUsedAt')
        .sort({ createdAt: -1 })
        .exec();

    return docs.map((d) => ({
        id: String(d._id),
        clientId: d.clientId,
        scope: d.scope,
        label: d.label,
        createdAt: d.createdAt,
        lastUsedAt: d.lastUsedAt,
    }));
}
