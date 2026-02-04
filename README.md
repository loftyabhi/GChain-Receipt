# TxProof (Enterprise Monorepo)

> A production-ready system to convert blockchain transactions into professional, audit-ready PDF receipts.

TxProof is a full-stack application designed to generate detailed financial receipts for blockchain transactions. It is architected as a **Secure Monorepo** with strict isolation between the frontend, backend, and smart contracts.

## 🌟 Key Features

- **Automated Receipt Generation**: Converts blockchain transactions into professional, audit-ready PDF receipts.
- **Transaction Classification**: Enterprise-grade deterministic semantic classifier for transaction types.
- **Public Developer APIs**: Robust API suite for programmatic transaction analysis and receipt generation.
- **Support System**: Accept donations via `SupportVault.sol` with **Anonymous** contribution support.
- **Event-Driven Indexer**: Hybrid indexing with live push-based ingestion + background verification.
- **Admin Dashboard**: Control center for ad management, user verification, and quota monitoring.
- **Zero-Knowledge Privacy**: Client-side processing architecture ensuring sensitive user data never leaves the browser.
- **Enterprise Security**: CSRF protection, admin wallet signatures, and strict resource isolation.
- **High-Fidelity Layouts**: Professional, printable layouts rendered natively in the browser.

## 🏗️ Architecture

This project uses a Workspace-based Monorepo structure:

```text
/
├── apps/
│   ├── web/                # [Next.js] Frontend & Client-Side Print Engine
│   └── api/                # [Node.js] Backend & Semantic Classifier
│
├── packages/
│   ├── domain/             # Shared Types & Schemas
│   ├── contracts/          # Smart Contracts & ABIs
│   ├── database/           # PostgreSQL Client & Migrations
│   └── config/             # Shared Environment Constants
```

### 🧠 Support System & Persistence
The "Show Your Support" feature uses a **Hybrid Indexing** strategy:
-   **Atomic Ingestion**: An `IndexerService` polls the smart contract and uses a custom RPC function to atomically ingest events into PostgreSQL.
-   **Automated Aggregation**: Database triggers automatically maintain a real-time leaderboard in the `contributors` table, ensuring O(1) read performance.
-   **Privacy**: Respects the on-chain `isAnonymous` flag for all display logic.


## 🚀 Quick Start

### Prerequisites
-   Node.js v22+ (LTS)
-   PostgreSQL (Supabase recommended)
-   Alchemy (or other RPC provider)

### Installation

1.  **Clone and Install**:
    ```bash
    git clone <repository-url>
    cd txproof
    npm install  # Installs all workspace dependencies
    ```

2.  **Configuration**:
    -   **Backend**: Create `apps/api/.env` (See `apps/api/.env.example` or DEPLOYMENT.md).
    -   **Frontend**: Create `apps/web/.env.local`.

### Development

To start the entire system (Frontend + Backend + Watchers):

```bash
npm run dev
```

Or run individual workspaces:

```bash
# Frontend only (localhost:3000)
npm run dev -w apps/web

# Backend only (localhost:3001)
npm run dev -w apps/api
```

## 📖 Documentation

-   [Deployment Guide](DEPLOYMENT.md): Instructions for Vercel and Render.
-   [Contributing](CONTRIBUTING.md): Guidelines for developing in the monorepo.
-   [Contribution System Architecture](docs/CONTRIBUTION_SYSTEM.md): Deep dive into the supporter leaderboard logic.
-   [Security Audit](SECURITY_AUDIT.md): Details on the security architecture.

## 📄 License

Private. All rights reserved.
