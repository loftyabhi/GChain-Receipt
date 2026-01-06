# Bill Generation Architecture (v2 Reference)

## 1. Core Philosophy: "Soft Queue & Client Render"

The v2 architecture moves away from heavy server-side processing (BullMQ/Redis/Puppeteer) towards a lightweight, database-backed coordination layer ("Soft Queue") and client-side rendering.

**Goals:**
*   **Free-Tier Safe:** No reliable background workers or Redis required.
*   **Horizontal Scalability:** Concurrency is managed via DB locks, allowing multiple API instances.
*   **Crash Recovery:** Polling-based recovery ensures no job is lost even if the server restarts.

## 2. softQueueService (The Coordinator)

The `SoftQueueService` replaces the traditional message queue. It uses a PostgreSQL table (`bill_jobs`) as the single source of truth.

### Key Mechanisms

1.  **Atomic Claiming (RPC)**:
    *   Jobs are claimed using a custom PostgreSQL function `claim_next_bill_job`.
    *   This performs a `SELECT ... FOR UPDATE SKIP LOCKED` to ensure that even if 10 API instances try to claim a job simultaneously, only 1 succeeds.

2.  **Token Bucket Concurrency**:
    *   Each API instance maintains a local counter (`processingSlots`).
    *   It will never accept more jobs than `MAX_CONCURRENT_JOBS` (Env Var), preventing CPU exhaustion on small VMs.

3.  **Event-Driven Loop**:
    *   Processing is triggered by events (Enqueue, Completion, Poll), not a permanent `setInterval` loop.
    *   This allows the server to idle at 0% CPU when no jobs are pending.

4.  **Heartbeat & Recovery**:
    *   Active jobs update a `heartbeat_at` timestamp every 10 seconds.
    *   If a server crashes, the job stops heartbeating.
    *   Subsequent requests check for "stale" heartbeats (> 5 mins) and reset those jobs to `pending`.

## 3. Data Flow

### A. Submission (`POST /resolve`)
1.  Frontend sends `txHash` + `chainId`.
2.  API checks `bills` table (Hard Idempotency) -> Returns immediately if done.
3.  API calls `SoftQueueService.enqueue`.
4.  DB `INSERT` into `bill_jobs` (Safe Idempotent Insert).
5.  API triggers `processNext()` (Fire-and-forget).
6.  Returns `jobId`.

### B. Processing (Background)
1.  `processNext()` checks local slots.
2.  Calls DB RPC to claim a job.
3.  **BillService** fetches data:
    *   **Optimized**: Batches pricing calls with concurrency limit (3).
    *   **Gated**: internal txs and ENS resolution are skipped if feature flags are off.
4.  Result is saved to `bills` table and Supabase Storage (JSON).
5.  Job marked `completed`.
6.  `processNext()` called again to drain queue.

### C. Polling (`GET /job/:id`)
1.  Frontend polls every 2s.
2.  API returns status (`pending`, `processing`, `completed`).
3.  **Smart ETA**: Calculates position based on active + pending jobs to give accurate wait time.
4.  When `completed`, returns the full Bill Data structure immediately for display.

## 4. Database Schema

### `bill_jobs`
| Column | Type | Purpose |
| :--- | :--- | :--- |
| `id` | UUID | Job Identifier |
| `tx_hash` | Text | Target Transaction |
| `status` | Enum | `pending`, `processing`, `completed`, `failed` |
| `heartbeat_at`| Timestamptz | Liveness check |
| `metadata` | JSONB | Context (Connected Wallet) |

### `bills`
| Column | Type | Purpose |
| :--- | :--- | :--- |
| `tx_hash` | Text | Unique Key |
| `bill_json` | JSONB | Complete ViewModel for Frontend |
| `status` | Text | `COMPLETED` |

## 5. Security & Limits

*   **Idempotency**: Enforced at DB level (Unique Index on TxHash).
*   **Crash Safety**: Heartbeats ensure no "zombie" jobs block the queue.
*   **Resource Control**: Feature flags (`ENABLE_INTERNAL_TX`) allow disabling expensive external API calls during high load.
