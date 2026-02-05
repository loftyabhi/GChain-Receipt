# SaaS Platform Architecture & Implementation

This document details the Enterprise SaaS API layer implemented for TxProof.

## 1. Core Components

### Database Schema
*   **`plans`**: Centralizes quota, rate-limit, and priority definitions. Now includes feature flags for **Webhooks**, **Custom Branding**, and **Bulk Actions**.
*   **`users`**: Upgraded to **UUID** primary keys with full profile support (`name`, `email`, `social_config`).
*   **`api_keys`**: Stores **hashed** keys (`key_hash`). Now links to users via `owner_user_id`. Includes `ip_allowlist` and `abuse_flag`.
*   **`email_verification_tokens`**: Managed secure tokens for enterprise identity verification (SHA-256 hashed).
*   **`auth_nonces`**: Implements replay protection for Wallet-based (SIWE) authentication.
*   **`api_usage_aggregates`**: Optimized for quota enforcement (Atomic Counting).
*   **`audit_logs`**: Immutable ledger of all sensitive actions, including **Email Verification** events.

### Migrations
*   **`master_schema.sql`**: The canonical single source of truth for the entire platform.

### Authentication & Security (`saasAuth.ts`, `publicRateLimiter.ts`)
*   **Strict Authorization Integration**:
    *   **validation**: Checks Active status and `abuse_flag`. Banned keys receive `403 Forbidden` (`INVALID_API_KEY`) and never downgrade to public access.
    *   **Network**: Enforces `ip_allowlist` if configured.
    *   **Realtime (RPS)**: In-memory/Redis Token Bucket prevents CPU spikes.
*   **Structured Errors**:
    *   Returns JSON with `code` field (e.g. `SECURITY_VIOLATION`, `RATE_LIMIT_EXCEEDED`).
*   **Hybrid Logic**:
    *   **Authenticated**: Full governance via `saasMiddleware`.
    *   **Public**: IP-based strict rate limiting via `publicRateLimiter` (Restricted to lightweight reads).
*   **Hashed Storage**: Raw keys are never stored. Only SHA-256 hashes.

### Enhanced Queue (`SoftQueueService.ts`)
*   **Priority Logic**: `ORDER BY priority DESC, created_at ASC`. Enterprise jobs (Priority 20) skip the line.
*   **Observability**:
    *   `wait_time_ms`: Time spent in queue (Pending -> Processing).
    *   `duration_ms`: Processing time.
    *   `cache_hit`: Tracks if generation was skipped due to existing bill.

### Analytics & SLA (`AnalyticsService.ts`)
*   **SLA Metrics**: System calculates p50, p95, and p99 latency automatically via SQL views (`distinct_daily_metrics`).
*   **Usage Tracking**: Asynchronously logs every request (Endpoint, IP, Status, Duration).

## 2. API Endpoints

### Public API (`v1/pdfs.ts`)
*   **`POST /api/v1/pdfs`**: Enqueue Job. Returns `202 Accepted`. (Strict SaaS Auth)
*   **`POST /api/v1/bills/resolve`**: Enqueue Bill Generation. **Strict SaaS Auth Only**. (Public access removed for safety).
*   **`GET /api/v1/pdfs/:jobId`**: Poll Status. Returns State + Data.
*   **`GET /api/v1/pdfs/by-tx/:txHash`**: Lookup by Transaction Hash.

### Admin Dashboard (`v1/adminRouter.ts`)
*   **Usage**: View daily requests and error rates.
*   **Keys**: Issue keys (Free/Pro/Enterprise), revoke keys. Calls are **Audit Logged**.

## 3. Deployment Instructions

1.  **Run Migrations**:
    ```sql
    -- Run in order:
    1. apps/api/scripts/setup_saas_db.sql
    2. apps/api/scripts/update_hardening.sql
    ```

2.  **Environment Variables**:
    Ensure `MAX_CONCURRENT_JOBS` is tuned for your server size.

3.  **API Usage**:
    Refer to [`API_REFERENCE.md`](./API_REFERENCE.md) for detailed actionable examples (cURL) and schema definitions.

## 4. Operational Runbook

*   **Banning a User**: Update `api_keys` set `abuse_flag = true` where `id = ?`.
*   **Restoring Service**: Update `api_keys` set `is_active = true`.
*   **Audit**: Query `audit_logs` table to see who issued a key.
*   **Performance Debugging**: Check `distinct_daily_metrics` view for high `p99_latency` or `avg_wait_time`.
