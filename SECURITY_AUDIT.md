# Security Audit & Posture Report
**Project:** Chain Receipt (GChain Receipt)
**Date:** January 05, 2026
**Version:** 1.0

## 1. Executive Summary
This document outlines the security architecture, potential risks, and implemented mitigations for the Chain Receipt ecosystem. The system is designed with a "Trust but Verify" approach, particularly in its interaction with blockchain data and user inputs.

## 2. Infrastructure Security

### 2.1 Backend (Node.js/Express)
-   **Environment Isolation:** Sensitive keys (`PRIVATE_KEY`, `ADMIN_PRIVATE_KEY`, `JWT_SECRET`) are stored in `.env` files and never committed to version control.
-   **Rate Limiting:** Implemented on public endpoints to prevent DoS attacks (configurable in `index.ts`).
-   **CORS Policy:** Strict CORS settings allowing only trusted domains (local and production frontend URLs).
-   **Helmet/Security Headers:** Added via middleware to prevent XSS and clickjacking.

### 2.2 Database (Supabase/PostgreSQL)
-   **Row Level Security (RLS):** Enabled on public tables where applicable.
-   **Connection Pooling:** Uses Transaction Pooler (Port 6543) for serverless environments to prevent connection malicious exhaustion.
-   **Least Privilege:** Application connects using a service role, but critical admin operations are gated by application-level logic.

## 3. Smart Contract Security (`SupportVault.sol`)

### 3.1 Contract Privileges
-   **Ownership:** The contract uses `Ownable` pattern. Only the `owner` can:
    -   Pause/Unpause the contract (`Pausable`).
    -   Withdraw funds (Native ETH or ERC20).
    -   Set minimum contribution limits.
    -   Update Token Allowlist.
-   **Risk:** Leakage of the Owner Private Key would allow an attacker to drain the vault.
    -   *Mitigation:* Owner key should be stored in a cold wallet or hardware wallet, separate from the hot wallet used for deployment/testing.

### 3.2 Logic & Reentrancy
-   **ReentrancyGuard:** Applied to `withdrawNative` and `withdrawERC20` functions to prevent reentrancy attacks during transfers.
-   **Pausable:** Emergency stop mechanism included to freeze all deposits and withdrawals in case of a discovered vulnerability.

## 4. Application Security

### 4.1 Contribution Ingestion (New Push-Based System)
-   **Idempotency:** The database enforces `UNIQUE(chain_id, tx_hash, log_index)` on the `contributor_events` table. Replaying a transaction hash will not duplicate data.
-   **Reorg Safety:** The system waits for **5 confirmations** before marking a contribution as `CONFIRMED`.
-   **Validation:**
    -   `txHash` format is strictly regex-validated (`^0x[a-fA-F0-9]{64}$`).
    -   Contract address and Event Topics are verified against the deployed contract to prevent spoofing with fake events from other contracts.

### 4.2 Authentication & Authorization
-   **Admin Access:** Secure Login via Wallet Signature (SIWE-like pattern).
    -   The Admin verifies ownership of the `ADMIN_ADDRESS` by signing a nonce.
    -   A JWT is issued upon successful verification.
    -   `verifyAdmin` middleware protects `AD` management and sensitive routes.
-   **JWT Security:** Tokens have a short expiration time and are signed with a strong `JWT_SECRET`.

### 4.3 Frontend
-   **Wallet Connection:** Uses `wagmi` / `AppKit` for secure provider handling.
-   **Input Sanitization:** All user inputs (Ad content, etc.) are sanitized to prevent Stored XSS, although Admin is considered a trusted entity.

## 5. Potential Vectors & Recommendations

| Severity | Vulnerability / Risk | Status | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **High** | Admin Key Leakage | Open | Use Hardware Wallet for Admin; Rotate JWT Secret periodically. |
| **Medium** | RPC Node Rate Limiting | Open | Use paid/private RPC endpoints (e.g., Alchemy/Infura) instead of public ones to avoid service disruption. |
| **Low** | PDF Generation DoS | Mitigated | PDF generation uses a **Soft Queue** (PostgreSQL) with strict concurrency limits (`MAX_CONCURRENT_JOBS`) and feature flags to prevent resource exhaustion. |
| **Low** | Fake "Pending" Spam | Mitigated | The `pending_contributions` table can be filled with random hashes, but the Worker validates them against the blockchain quickly, marking invalid ones as failed. Regular cleanup job recommended. |

## 6. Audit Logs
-   **Ads:** Creation and Deletion of ads are logged to console (in future, should move to permanent audit log table).
-   **Contributions:** Full lifecycle is tracked in `pending_contributions` with timestamps (`created_at`, `confirmed_at`) and `last_error` for debugging failures.

## 7. Incident Response Plan
1.  **Contract Breach:** Call `pause()` on `SupportVault` immediately using the Admin Dashboard.
2.  **API Abuse:** Revoke `JWT_SECRET` (change env var) to force logout all admins. Enable stricter IP rate limiting on Cloudflare/Host.
3.  **Data Corruption:** Restore from Supabase Point-in-Time Recovery (PITR) backups.

---
*Verified by Antigravity Agent*
*Reference Codebase: @repo/contracts, apps/api, apps/web*
