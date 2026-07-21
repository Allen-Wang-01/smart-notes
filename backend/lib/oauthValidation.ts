import crypto from 'crypto';

// Pure, DB-free helpers for the OAuth authorize/register endpoints.
// Kept separate from the controller so the security-critical validation
// logic can be unit-tested without a live Mongo/Redis connection.

/**
 * A redirect URI is acceptable if it is a syntactically valid URL that is
 * either https, or http restricted to loopback hosts (localhost / 127.0.0.1
 * / [::1]) for local development. Everything else (custom schemes, plain http
 * to a public host, malformed strings) is rejected.
 */
export function isValidRedirectUri(uri: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(uri);
    } catch {
        return false;
    }

    if (parsed.protocol === 'https:') return true;

    if (parsed.protocol === 'http:') {
        const host = parsed.hostname;
        return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    }

    return false;
}

export interface RedirectUrisValidation {
    valid: boolean;
    error?: string;
}

/**
 * Validate the redirect_uris array submitted at registration time.
 * Must be a non-empty array where every entry passes isValidRedirectUri.
 */
export function validateRedirectUris(uris: unknown): RedirectUrisValidation {
    if (!Array.isArray(uris) || uris.length === 0) {
        return { valid: false, error: 'redirect_uris must be a non-empty array' };
    }
    for (const uri of uris) {
        if (typeof uri !== 'string' || !isValidRedirectUri(uri)) {
            return {
                valid: false,
                error: `Invalid redirect_uri: ${String(uri)} (must be https, or http for localhost)`,
            };
        }
    }
    return { valid: true };
}

/**
 * Strict, exact-string allow-list match. This is the single most important
 * security check in the authorize flow — NO substring, prefix, or normalized
 * comparison, because a loose match lets an attacker redirect the auth code to
 * a URL they control.
 */
export function isRegisteredRedirectUri(
    presented: string,
    registered: readonly string[],
): boolean {
    return registered.includes(presented);
}

/** High-entropy public client identifier (no secret is ever issued). */
export function generateClientId(): string {
    return `mcp_client_${crypto.randomBytes(24).toString('hex')}`;
}

/** High-entropy one-time authorization code. */
export function generateAuthCode(): string {
    return crypto.randomBytes(32).toString('base64url');
}

export type AuthorizeValidationError =
    | 'unsupported_response_type'
    | 'invalid_request'
    | 'invalid_code_challenge_method';

export interface AuthorizeParams {
    response_type?: string;
    code_challenge?: string;
    code_challenge_method?: string;
}

export interface AuthorizeValidationResult {
    valid: boolean;
    error?: AuthorizeValidationError;
    error_description?: string;
}

/**
 * Validate the protocol-level authorize parameters that do NOT require a DB
 * lookup (client_id existence and redirect_uri match are checked separately in
 * the controller, since they hit Mongo). Enforces:
 *   - response_type === 'code'
 *   - code_challenge present (PKCE mandatory)
 *   - code_challenge_method === 'S256' (reject 'plain')
 */
export function validateAuthorizeParams(
    params: AuthorizeParams,
): AuthorizeValidationResult {
    if (params.response_type !== 'code') {
        return {
            valid: false,
            error: 'unsupported_response_type',
            error_description: "response_type must be 'code'",
        };
    }

    if (!params.code_challenge || typeof params.code_challenge !== 'string') {
        return {
            valid: false,
            error: 'invalid_request',
            error_description: 'code_challenge is required (PKCE)',
        };
    }

    if (params.code_challenge_method !== 'S256') {
        return {
            valid: false,
            error: 'invalid_code_challenge_method',
            error_description: "code_challenge_method must be 'S256'",
        };
    }

    return { valid: true };
}
