# System Architecture & Data Strategy

## 1. Data Persistence (Supabase)

The platform uses **Supabase** as the primary source of truth for reliable, persistent storage. It is used in two distinct capacities: Relational Database and Object Storage.

### A. Database (PostgreSQL)
We bypass Prisma for specific high-performance queries, interacting directly with the PostgreSQL instance via the Supabase Client.

#### Core Tables
| Table | Purpose | Critical Fields | Preservation Strategy |
| :--- | :--- | :--- | :--- |
| **`bills`** | **Primary Record** of generated receipts. Acts as the Authoritative Ledger. | `tx_hash` (PK), `chain_id`, `bill_json` (JSONB), `status` | **Permanent**. Records are immutable once `status = COMPLETED`. |
| **`ad_profiles`** | **Campaign Management** for dynamic receipt ads. | `name`, `html_content`, `placement`, `is_active` | **Soft Delete**. Uses `is_deleted` flag to maintain audit trails. |

### B. Object Storage (Buckets)
| Bucket | Purpose | Content Type | Role |
| :--- | :--- | :--- | :--- |
| **`receipts`** | **Redundancy & Delivery**. Stores pre-computed JSON models of bills. | `application/json` | **Backup / CDN Origin**. If DB is unreachable, the system attempts to fetch the static JSON file from here. |

---

## 2. Caching Strategy (3-Layer Architecture)

To ensure "Enterprise-Grade" performance and deterministic pricing cost-handling, we implement a strict 3-layer caching waterfall.

### Layer 1: Price Oracle (Redis)
**Purpose**: Minimize calls to expensive external price APIs (Alchemy, CoinGecko) and ensure tax-lot consistency.
*   **Technology**: Redis (via `ioredis`).
*   **Retention**:
    *   **Historical Prices**: `30 Days` (High consistency required for audit).
    *   **Current Prices**: `5 Minutes` (Real-time display).
*   **Key Source**: `apps/api/src/services/PriceOracleService.ts`

### Layer 2: Classification Logic (In-Memory)
**Purpose**: Micro-optimization for heavy regex and semantic rule evaluation during high-throughput ingestion.
*   **Technology**: JS `Map<string, Result>`.
*   **Retention**: LRU Strategy (Limit: 100 items).
*   **Key Source**: `apps/api/src/services/classifier/core/Engine.ts`

### Layer 3: Bill Idempotency (Database)
**Purpose**: Prevent re-processing of immutable blockchain transactions.
*   **Logic**: Before generation, `BillService` queries the `bills` table.
*   **Hit**: Returns `bill_json` instantly (0 RPC calls).
*   **Miss**: Triggers full generation cost.
*   **Key Source**: `apps/api/src/services/BillService.ts`

---

## 3. Privacy & Security Architecture

### Analytics Guard
*   **Zero-Telemetry Default**: The system is engineered to send **zero** bytes of event data to Google Analytics until explicit consent is granted.
*   **Identity Protection**:
    *   **IP Anonymization**: Enforced at Gtag/SDK level.
    *   **Hash Sanitization**: Middleware (`analytics.ts`) strictly strips any 10+ char hex string from custom events to prevent PII leakage.

### Infrastructure
*   **Queue System**: `SoftQueueService` (In-memory) manages concurrency constraints to prevent rate-limit bans from RPC providers.
*   **Runtime**: API runs on Node.js; Web runs on Next.js Edge/Node hybrid (specifically `nodejs` runtime for Mailer).
*   **Traffic Control**:
    *   **Rate Limiting**: Token Bucket algorithm enforced on all public endpoints. Clients receive `429` with exponential backoff guidance.
    *   **Response Hardening**: Sensitive transaction endpoints serve `Cache-Control: no-store` to prevent CDN/Proxy caching of financial data.

---

## 4. Deterministic Output Philosophy For Audits
To maintain "Infrastructure-Grade" reliability, the system prioritizes deterministic outputs over generative guesswork.
*   **Input**: `(ChainId, TxHash)`
*   **Output**: Always identical JSON for the same input version.
*   **No Heuristics**: If a transaction type is ambiguous, it returns `UNSUPPORTED` rather than guessing.
*   **Human-Readable**: Error messages (`TransactionError.tsx`) are designed to be safe, neutral, and actionable, never exposing stack traces.
