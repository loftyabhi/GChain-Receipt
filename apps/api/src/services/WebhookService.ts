import { supabase } from '../lib/supabase';
import { z } from 'zod';
import axios from 'axios';
import { ApiKeyService } from './ApiKeyService';
import {
    generateSecureSecret,
    encryptSecret,
    decryptSecret,
    signWebhookPayload,
    verifyWebhookSignature,
    canonicalStringify,
    getActiveKeyVersion,
    verifySecretIntegrity
} from '../lib/cryptography';
import { logger, createComponentLogger } from '../lib/logger';

const webhookLogger = createComponentLogger('WebhookService');

export interface Webhook {
    id: string;
    api_key_id: string;
    url: string;
    secret_encrypted: string;
    secret_iv: string;
    secret_tag: string;
    secret_last4: string;
    encryption_key_version: string;
    health_status: 'active' | 'broken' | 'rotated';
    last_health_check?: string;
    health_error?: string;
    rotated_at?: string;
    events: string[];
    is_active: boolean;
    created_at: string;
}

export interface WebhookEvent {
    id: string;
    event_id: string;
    event_type: string;
    payload: any;
    status: 'pending' | 'processing' | 'success' | 'failed';
    next_retry_at: string;
}

// Webhook configuration constants
const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 1000; // 1s, 2s, 4s, 8s, 16s
const REQUEST_TIMEOUT_MS = 5000;
const MAX_CONCURRENT_DELIVERIES = 5;
const BATCH_SIZE = 10;

// Payload validation schema
const WebhookPayloadSchema = z.object({
    event_type: z.string(),
    data: z.any(),
    id: z.string().optional(),
    txHash: z.string().optional(),
    timestamp: z.number().optional()
});

/**
 * PRODUCTION-GRADE WEBHOOK SERVICE
 * 
 * Features:
 * - Cryptographically secure secret generation
 * - AES-256-GCM secret encryption
 * - Canonical JSON payload signing with HMAC
 * - Idle

mpotent event delivery
 * - Bounded retries with exponential backoff
 * - Concurrency-limited async delivery
 * - Dead-letter queue for permanent failures
 * - Structured logging
 * - Replay attack prevention
 */
export class WebhookService {
    private apiKeyService = new ApiKeyService();
    private deliveryQueue: Set<string> = new Set(); // Track in-flight deliveries
    private isProcessing = false;

    // --- CRUD Operations ---

    /**
     * Create a new webhook with cryptographically secure secret
     */
    async createWebhook(apiKeyId: string, url: string, events: string[]) {
        // 1. Validation
        if (!url.startsWith('https://')) {
            throw new Error('Webhook URL must be HTTPS');
        }
        if (events.length === 0) {
            throw new Error('At least one event must be subscribed');
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            throw new Error('Invalid URL format');
        }

        // 2. Generate cryptographically secure secret
        const secret = generateSecureSecret();
        const secretLast4 = secret.slice(-4);

        // 3. Encrypt secret using AES-256-GCM with versioned key
        const activeVersion = getActiveKeyVersion();
        const { encrypted, iv, tag, version } = encryptSecret(secret, activeVersion);

        // 4. Insert webhook
        const { data, error } = await supabase
            .from('webhooks')
            .insert({
                api_key_id: apiKeyId,
                url,
                secret_encrypted: encrypted,
                secret_iv: iv,
                secret_tag: tag,
                secret_last4: secretLast4,
                encryption_key_version: version,
                health_status: 'active',
                last_health_check: new Date().toISOString(),
                events,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            webhookLogger.error('Failed to create webhook', { apiKeyId, error: error.message });
            throw error;
        }

        webhookLogger.info('Webhook created', { webhookId: data.id, url, events });

        return { webhook: data, secret }; // Return secret ONCE for user to save
    }

    /**
     * List all webhooks for an API key
     */
    async listWebhooks(apiKeyId: string): Promise<Webhook[]> {
        const { data, error } = await supabase
            .from('webhooks')
            .select('*')
            .eq('api_key_id', apiKeyId)
            .order('created_at', { ascending: false });

        if (error) {
            webhookLogger.error('Failed to list webhooks', { apiKeyId, error: error.message });
            throw error;
        }

        return data || [];
    }

    /**
     * Delete a webhook (enforces ownership)
     */
    async deleteWebhook(id: string, apiKeyId: string) {
        const { error } = await supabase
            .from('webhooks')
            .delete()
            .eq('id', id)
            .eq('api_key_id', apiKeyId);

        if (error) {
            webhookLogger.error('Failed to delete webhook', { webhookId: id, error: error.message });
            throw error;
        }

        webhookLogger.info('Webhook deleted', { webhookId: id });
    }

    /**
     * securely rotate webhook secret
     * Generates new secret with ACTIVE key version
     * Archives old secret (implicitly, by replacing it)
     */
    async rotateWebhookSecret(id: string, apiKeyId: string) {
        // 1. Fetch current webhook to verify ownership
        const { data: webhook, error: fetchError } = await supabase
            .from('webhooks')
            .select('*')
            .eq('id', id)
            .eq('api_key_id', apiKeyId)
            .single();

        if (fetchError || !webhook) {
            throw new Error('Webhook not found');
        }

        // 2. Generate new cryptographically secure secret
        const secret = generateSecureSecret();
        const secretLast4 = secret.slice(-4);
        const activeVersion = getActiveKeyVersion();

        // 3. Encrypt with CURRENT active key version
        const { encrypted, iv, tag, version } = encryptSecret(secret, activeVersion);

        // 4. Atomic update
        const { data, error } = await supabase
            .from('webhooks')
            .update({
                secret_encrypted: encrypted,
                secret_iv: iv,
                secret_tag: tag,
                secret_last4: secretLast4,
                encryption_key_version: version,
                // Reset health status on rotation
                health_status: 'active',
                health_error: null,
                last_health_check: new Date().toISOString(),
                rotated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('api_key_id', apiKeyId)
            .select()
            .single();

        if (error) {
            webhookLogger.error('Failed to rotate secret', { webhookId: id, error: error.message });
            throw error;
        }

        webhookLogger.info('Webhook secret rotated', {
            webhookId: id,
            keyVersion: version,
            previousVersion: webhook.encryption_key_version
        });

        return { webhook: data, secret };
    }

    /**
     * Test a webhook by sending a sample event
     */
    async testWebhook(id: string, apiKeyId: string) {
        // 1. Fetch webhook
        const { data: webhook, error } = await supabase
            .from('webhooks')
            .select('*')
            .eq('id', id)
            .eq('api_key_id', apiKeyId)
            .single();

        if (error || !webhook) {
            throw new Error('Webhook not found');
        }

        // 2. Create sample payload
        const samplePayload = {
            id: `test_${Date.now()}`,
            type: 'bill.completed',
            created_at: new Date().toISOString(),
            data: {
                bill_id: 'bill_test_123456',
                transaction_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                chain_id: 8453,
                status: 'completed',
                amount: '1000000000000000000',
                currency: 'ETH',
                recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
                timestamp: new Date().toISOString()
            }
        };

        // 3. Decrypt secret for signing
        const secret = decryptSecret(
            webhook.secret_encrypted,
            webhook.secret_iv,
            webhook.secret_tag
        );

        // 4. Sign payload
        const signature = signWebhookPayload(samplePayload, secret);

        // 5. Send HTTP request
        const startTime = Date.now();
        try {
            const response = await axios.post(webhook.url, samplePayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-TxProof-Signature': signature,
                    'X-TxProof-Event-Type': 'bill.completed',
                    'User-Agent': 'TxProof-Webhooks/1.0'
                },
                timeout: REQUEST_TIMEOUT_MS,
                validateStatus: () => true // Don't throw on any status
            });

            const responseTime = Date.now() - startTime;

            webhookLogger.info('Test webhook sent', {
                webhookId: id,
                url: webhook.url,
                statusCode: response.status,
                responseTime
            });

            return {
                success: response.status >= 200 && response.status < 300,
                statusCode: response.status,
                responseTime,
                payload: samplePayload,
                payload_canonical: canonicalStringify(samplePayload),
                response: typeof response.data === 'string'
                    ? response.data
                    : JSON.stringify(response.data)
            };

        } catch (error: any) {
            const responseTime = Date.now() - startTime;

            webhookLogger.error('Test webhook failed', {
                webhookId: id,
                url: webhook.url,
                error: error.message
            });

            return {
                success: false,
                error: error.message || 'Network error',
                responseTime,
                payload: samplePayload
            };
        }
    }

    // --- Event Dispatch & Delivery ---

    /**
     * Dispatch an event to all subscribed webhooks
     * Creates idempotent event records for async processing
     */
    async dispatch(eventType: string, payload: any, apiKeyId: string | null) {
        if (!apiKeyId) {
            webhookLogger.debug('Skipping webhook dispatch (no API key)', { eventType });
            return;
        }

        try {
            // Validate payload structure
            const validatedPayload = WebhookPayloadSchema.parse({
                event_type: eventType,
                data: payload,
                ...payload
            });

            // 1. Find active subscribers
            const { data: hooks } = await supabase
                .from('webhooks')
                .select('*')
                .eq('api_key_id', apiKeyId)
                .eq('is_active', true)
                .contains('events', [eventType]);

            if (!hooks || hooks.length === 0) {
                webhookLogger.debug('No webhook subscribers found', { eventType, apiKeyId });
                return;
            }

            // 2. Create idempotent event ID
            const entityId = payload.id || payload.txHash || payload.billId || Date.now().toString();
            const eventId = `evt_${entityId}_${eventType}`;

            // 3. Insert event records for each webhook
            const inserts = hooks.map(h => ({
                event_id: `${eventId}_${h.id}`, // Unique per webhook
                webhook_id: h.id,
                event_type: eventType,
                payload: validatedPayload,
                status: 'pending' as const,
                attempt_count: 0,
                next_retry_at: new Date().toISOString()
            }));

            const { error } = await supabase
                .from('webhook_events')
                .insert(inserts)
                .select();

            if (error) {
                // Check for duplicate event_id (idempotency)
                if (error.code === '23505') {
                    webhookLogger.info('Duplicate event ignored (idempotent)', { eventId });
                    return;
                }
                webhookLogger.error('Failed to dispatch webhook events', { eventType, error: error.message });
                return;
            }

            webhookLogger.info('Webhook events dispatched', {
                eventType,
                webhooksCount: hooks.length,
                eventId
            });

            // 4. Trigger async delivery worker (non-blocking)
            setImmediate(() => this.processDeliveryBatch());

        } catch (error: any) {
            webhookLogger.error('Webhookdispatch error', { eventType, error: error.message });
        }
    }

    /**
     * Process pending webhook deliveries in batches
     * Implements concurrency limiting and bounded execution
     */
    async processDeliveryBatch() {
        // Prevent concurrent batch processing
        if (this.isProcessing) {
            webhookLogger.debug('Delivery batch already processing, skipping');
            return;
        }

        this.isProcessing = true;

        try {
            // 1. Fetch pending events that are ready for delivery
            const { data: events } = await supabase
                .from('webhook_events')
                .select('*, webhooks!inner(url, secret_encrypted, secret_iv, secret_tag)')
                .in('status', ['pending', 'processing'])
                .lt('next_retry_at', new Date().toISOString())
                .limit(BATCH_SIZE);

            if (!events || events.length === 0) {
                webhookLogger.debug('No pending webhook events');
                return;
            }

            webhookLogger.info('Processing webhook delivery batch', { eventsCount: events.length });

            // 2. Process events with concurrency limiting
            const deliveryPromises: Promise<void>[] = [];

            for (const event of events) {
                // Wait if at max concurrency
                while (this.deliveryQueue.size >= MAX_CONCURRENT_DELIVERIES) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                const deliveryPromise = this.deliverEvent(event)
                    .finally(() => {
                        this.deliveryQueue.delete(event.id);
                    });

                this.deliveryQueue.add(event.id);
                deliveryPromises.push(deliveryPromise);
            }

            // Wait for all deliveries to complete
            await Promise.all(deliveryPromises);

            webhookLogger.info('Delivery batch completed', { eventsProcessed: events.length });

        } catch (error: any) {
            webhookLogger.error('Delivery batch processing error', { error: error.message });
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Decrypt webhook secret with integrity verification AND health check
     * @throws Error if encryption/integrity check fails
     */
    private async getVerifiedSecret(webhook: any): Promise<string> {
        try {
            // Decrypt using stored key version (default to v1 for legacy)
            const secret = decryptSecret(
                webhook.secret_encrypted,
                webhook.secret_iv,
                webhook.secret_tag,
                webhook.encryption_key_version || 'v1'
            );

            // CRITICAL: Verify integrity against DB record
            const integrityValid = verifySecretIntegrity(
                secret,
                webhook.secret_last4
            );

            if (!integrityValid) {
                // Fail hard: Mark broken, stop delivery for this webhook
                await this.markWebhookBroken(
                    webhook.id,
                    'Secret integrity check failed - internal mismatch'
                );

                throw new Error(
                    `Webhook ${webhook.id} failed integrity check - marked as broken`
                );
            }

            return secret;

        } catch (error: any) {
            webhookLogger.error('Secret verification failed', {
                webhookId: webhook.id,
                error: error.message,
                keyVersion: webhook.encryption_key_version
            });

            // If decryption failed entirely (e.g. wrong key), mark broken
            if (!webhook.health_status || webhook.health_status === 'active') {
                await this.markWebhookBroken(
                    webhook.id,
                    `Decryption failed: ${error.message}`
                );
            }

            throw error;
        }
    }

    /**
     * Mark webhook as broken and stop delivery
     */
    private async markWebhookBroken(webhookId: string, reason: string) {
        await supabase
            .from('webhooks')
            .update({
                health_status: 'broken',
                health_error: reason,
                last_health_check: new Date().toISOString(),
                // NOTE: We do NOT set is_active: false based on policy
                // Delivery logic checks health_status explicitly
            })
            .eq('id', webhookId);

        webhookLogger.error('Webhook marked as broken', {
            webhookId,
            reason
        });
    }

    /**
     * Deliver a single webhook event with retry logic
     */
    private async deliverEvent(event: any) {
        const webhook = event.webhooks;
        if (!webhook) {
            webhookLogger.error('Webhook not found for event', { eventId: event.id });
            return;
        }

        // CRITICAL: Check health status before delivery attempts
        // We decouple 'is_active' (user intent) from 'health_status' (system health)
        if (webhook.health_status === 'broken') {
            webhookLogger.warn('Skipping delivery - webhook is broken', {
                webhookId: webhook.id,
                error: webhook.health_error
            });

            await supabase
                .from('webhook_events')
                .update({
                    status: 'failed',
                    response_body: `Webhook broken: ${webhook.health_error}`
                })
                .eq('id', event.id);
            return;
        }

        const eventLogger = logger.child({
            eventId: event.id,
            webhookId: webhook.id,
            attempt: event.attempt_count + 1
        });

        // Mark as processing
        await supabase
            .from('webhook_events')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', event.id);

        try {
            // 1. Get verified secret (includes decryption + integrity check)
            const secret = await this.getVerifiedSecret(webhook);

            // 2. Sign payload with canonical JSON + timestamp
            const signature = signWebhookPayload(event.payload, secret);

            // 3. Send HTTP request with timeout
            const startTime = Date.now();
            const response = await axios.post(webhook.url, event.payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-TxProof-Signature': signature,
                    'X-TxProof-Event': event.event_type,
                    'X-TxProof-Event-Id': event.event_id,
                    'User-Agent': 'TxProof-Webhook/1.0'
                },
                timeout: REQUEST_TIMEOUT_MS,
                validateStatus: (status) => status >= 200 && status < 300
            });

            const duration = Date.now() - startTime;

            // 4. Success - update event
            await supabase
                .from('webhook_events')
                .update({
                    status: 'success',
                    response_status: response.status,
                    response_body: JSON.stringify(response.data).slice(0, 1000),
                    // Store canonical payload that was actually signed/sent
                    payload_canonical: canonicalStringify(event.payload),
                    updated_at: new Date().toISOString()
                })
                .eq('id', event.id);

            eventLogger.info('Webhook delivered successfully', {
                duration,
                status: response.status
            });

        } catch (error: any) {
            // 5. Failure - implement bounded retry logic
            const attempt = event.attempt_count + 1;
            const maxRetriesReached = attempt >= MAX_RETRIES;
            const status = maxRetriesReached ? 'failed' : 'pending';

            // Calculate next retry time with exponential backoff
            const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
            const nextRetry = new Date(Date.now() + backoffMs).toISOString();

            const responseStatus = error.response?.status || 0;
            const errorMessage = error.message || 'Unknown error';

            await supabase
                .from('webhook_events')
                .update({
                    status: status,
                    response_status: responseStatus,
                    response_body: errorMessage.substring(0, 1000),
                    attempt_count: attempt,
                    next_retry_at: maxRetriesReached ? null : nextRetry,
                    updated_at: new Date().toISOString()
                })
                .eq('id', event.id);

            if (maxRetriesReached) {
                eventLogger.error('Webhook delivery failed permanently (max retries)', {
                    attempts: attempt,
                    error: errorMessage,
                    status: responseStatus
                });

                // Dead-letter queue: log for manual review
                webhookLogger.error('DEAD LETTER: Webhook event failed permanently', {
                    eventId: event.id,
                    eventType: event.event_type,
                    webhookUrl: webhook.url,
                    attempts: attempt,
                    error: errorMessage
                });
            } else {
                eventLogger.warn('Webhook delivery failed, will retry', {
                    attempts: attempt,
                    nextRetry,
                    error: errorMessage
                });
            }
        }
    }

    /**
     * Start continuous delivery worker (should be called on server start)
     * Processes webhooks in the background every 10 seconds
     */
    startDeliveryWorker() {
        webhookLogger.info('Starting webhook delivery worker');

        // Process immediately
        this.processDeliveryBatch();

        // Then process every 10 seconds
        setInterval(() => {
            this.processDeliveryBatch();
        }, 10000);
    }
}
