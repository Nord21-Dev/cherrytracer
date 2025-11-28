/**
 * Sensitive Data Scrubber
 * Automatically redacts sensitive fields from log data
 */

const DEFAULT_SENSITIVE_KEYS = [
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'apikey',
    'api_key',
    'apiKey',
    'accesstoken',
    'access_token',
    'accessToken',
    'refreshtoken',
    'refresh_token',
    'refreshToken',
    'auth',
    'authorization',
    'cookie',
    'cookies',
    'csrf',
    'xsrf',
    'private',
    'privatekey',
    'private_key',
    'privateKey',
    'ssn',
    'creditcard',
    'credit_card',
    'cardnumber',
    'card_number',
    'cvv',
    'pin',
    'security_answer',
    'securityAnswer',
];

const REDACTED = '[REDACTED]';

/**
 * Check if a key should be scrubbed
 */
function isSensitiveKey(key: string, customKeys: string[]): boolean {
    const keyLower = key.toLowerCase();
    const allKeys = [...DEFAULT_SENSITIVE_KEYS, ...customKeys.map(k => k.toLowerCase())];
    return allKeys.some(sensitiveKey => keyLower.includes(sensitiveKey));
}

/**
 * Deep scrub an object, redacting sensitive fields
 */
export function scrubSensitiveData(data: any, customKeys: string[] = []): any {
    // Handle null/undefined
    if (data == null) {
        return data;
    }

    // Handle primitives
    if (typeof data !== 'object') {
        return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => scrubSensitiveData(item, customKeys));
    }

    // Handle Error objects specially (preserve stack trace but scrub message)
    if (data instanceof Error) {
        return {
            name: data.name,
            message: data.message, // Keep message as-is for debugging
            stack: data.stack,
        };
    }

    // Handle regular objects
    const scrubbed: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
        if (isSensitiveKey(key, customKeys)) {
            scrubbed[key] = REDACTED;
        } else if (value && typeof value === 'object') {
            scrubbed[key] = scrubSensitiveData(value, customKeys);
        } else {
            scrubbed[key] = value;
        }
    }

    return scrubbed;
}

/**
 * Scrub sensitive data from error stack traces
 * This is a simple implementation that doesn't modify the stack
 * In production, you might want more sophisticated stack scrubbing
 */
export function scrubErrorData(error: any, customKeys: string[] = []): any {
    if (!error) return error;

    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }

    return scrubSensitiveData(error, customKeys);
}
