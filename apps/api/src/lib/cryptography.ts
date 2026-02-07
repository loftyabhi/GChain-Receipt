import { ethers } from 'ethers';
import canonicalize from 'canonicalize';

/**
 * RFC 8785 Canonical JSON Serialization for deterministic hashing
 * Ensures consistent hash generation across all systems
 */
export function canonicalStringify(obj: any): string {
    const canonical = canonicalize(obj);
    if (!canonical) {
        throw new Error('Failed to canonicalize object');
    }
    return canonical;
}

/**
 * Compute deterministic keccak256 hash of receipt data
 * Uses canonical JSON serialization to ensure hash stability
 */
export function computeReceiptHash(billData: any): string {
    // Create immutable core data (exclude presentation fields)
    const coreData = extractCoreData(billData);

    // Canonicalize and hash
    const canonicalString = canonicalStringify(coreData);
    const hash = ethers.keccak256(ethers.toUtf8Bytes(canonicalString));

    return hash;
}

/**
 * Extract only core transaction data (exclude branding/presentation)
 * This ensures branding changes don't invalidate cryptographic proofs
 */
function extractCoreData(billData: any): any {
    const {
        // Exclude presentation-only fields
        BRANDING,
        RECEIPT_HASH,
        HASH_ALGO,
        hasAd,
        adContent,
        adUrl,
        adId,
        QR_CODE_DATA_URL,

        // Keep all transaction data
        ...coreData
    } = billData;

    return coreData;
}

/**
 * Verify receipt hash integrity
 * Recomputes hash and compares with stored value
 */
export function verifyReceiptHash(billData: any, expectedHash: string): {
    valid: boolean;
    computedHash: string;
    expectedHash: string;
} {
    const computedHash = computeReceiptHash(billData);

    return {
        valid: computedHash === expectedHash,
        computedHash,
        expectedHash
    };
}

/**
 * Generate cryptographically secure webhook secret
 * Uses crypto.randomBytes instead of Math.random
 */

/**
 * Get encryption key by version
 * Supports multiple keys for rotation (v1, v2, etc.)
 */
function getEncryptionKey(version: string = 'v1'): string {
    const envKey = `WEBHOOK_ENCRYPTION_KEY_${version.toUpperCase()}`;
    let key = process.env[envKey];

    // Fallback to legacy key for v1
    if (!key && version === 'v1') {
        key = process.env.WEBHOOK_ENCRYPTION_KEY;
    }

    if (!key) {
        throw new Error(`Encryption key ${version} not configured in ${envKey}`);
    }

    if (key.length !== 64) {
        throw new Error(`Invalid encryption key ${version}: must be 64 hex characters`);
    }

    return key;
}

/**
 * Get active encryption key version from environment
 */
export function getActiveKeyVersion(): string {
    return process.env.WEBHOOK_ENCRYPTION_KEY_ACTIVE || 'v1';
}

/**
 * Generate cryptographically secure webhook secret
 * Uses crypto.randomBytes instead of Math.random
 */
export function generateSecureSecret(): string {
    const crypto = require('crypto');
    const randomBytes = crypto.randomBytes(32);
    const secret = `whsec_${randomBytes.toString('hex')}`;
    return secret;
}

/**
 * Encrypt webhook secret using AES-256-GCM
 * Requires WEBHOOK_ENCRYPTION_KEY environment variable
 */
/**
 * Encrypt webhook secret using AES-256-GCM with versioned keys
 * Returns ciphertext, IV, authentication tag, and key version
 */
export function encryptSecret(
    secret: string,
    version?: string
): {
    encrypted: string;
    iv: string;
    tag: string;
    version: string;
} {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';

    // Use provided version or get active version from env
    const keyVersion = version || getActiveKeyVersion();
    const key = getEncryptionKey(keyVersion);
    const keyBuffer = Buffer.from(key, 'hex');

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        version: keyVersion
    };
}

/**
 * Decrypt webhook secret using stored key version
 */
export function decryptSecret(
    encrypted: string,
    iv: string,
    tag: string,
    version: string = 'v1'
): string {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';

    const key = getEncryptionKey(version);
    const keyBuffer = Buffer.from(key, 'hex');
    const ivBuffer = Buffer.from(iv, 'hex');
    const tagBuffer = Buffer.from(tag, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, ivBuffer);
    decipher.setAuthTag(tagBuffer);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Verify secret integrity - CRITICAL security check
 * Ensures decrypted secret matches expected last 4 characters
 * @returns true if integrity verified, false otherwise
 */
export function verifySecretIntegrity(
    decryptedSecret: string,
    expectedLast4: string
): boolean {
    if (!decryptedSecret || decryptedSecret.length < 4) {
        return false;
    }

    if (!expectedLast4 || expectedLast4.length !== 4) {
        return false;
    }

    const actualLast4 = decryptedSecret.slice(-4);
    return actualLast4 === expectedLast4;
}

/**
 * Sign webhook payload with HMAC-SHA256
 * Uses canonical JSON to ensure consistent signatures
 */
export function signWebhookPayload(payload: any, secret: string): string {
    const crypto = require('crypto');

    // Canonicalize payload
    const canonicalPayload = canonicalStringify(payload);

    // Add timestamp to prevent replay attacks
    const timestamp = Math.floor(Date.now() / 1000);
    const signedContent = `${timestamp}.${canonicalPayload}`;

    // Create HMAC signature
    const signature = crypto
        .createHmac('sha256', secret)
        .update(signedContent)
        .digest('hex');

    return `t=${timestamp},v1=${signature}`;
}

/**
 * Verify webhook signature
 * Returns true if signature is valid and within replay window
 */
export function verifyWebhookSignature(
    payload: any,
    signatureHeader: string,
    secret: string,
    toleranceSeconds: number = 300
): boolean {
    const crypto = require('crypto');

    // Parse signature header
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
        return false;
    }

    const timestamp = parseInt(timestampPart.split('=')[1]);
    const expectedSignature = signaturePart.split('=')[1];

    // Check replay window
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
        return false;
    }

    // Recompute signature
    const canonicalPayload = canonicalStringify(payload);
    const signedContent = `${timestamp}.${canonicalPayload}`;

    const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedContent)
        .digest('hex');

    // Constant-time comparison
    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(computedSignature)
    );
}

/**
 * Generate a cryptographically secure random token
 * Used for verification links
 */
export function generateRandomToken(bytes: number = 32): string {
    const crypto = require('crypto');
    return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Compute SHA256 hash of a token
 * Used for storing tokens securely in the database
 */
export function hashToken(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
}
