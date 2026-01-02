# Chain Receipt System (Enterprise Monorepo)

> A production-ready system to convert blockchain transactions into professional, audit-ready PDF receipts.

Chain Receipt is a full-stack application designed to generate detailed financial receipts for blockchain transactions. It is architected as a **Secure Monorepo** with strict isolation between the frontend, backend, and smart contracts.

## 🌟 Key Features

-   **Automated Receipt Generation**: Converts transaction hashes into downloadable PDF receipts.
-   **Show Your Support**: A decentralized contribution system on Base Sepolia allowing users to support the project via native ETH or ERC20 tokens.
-   **Admin Dashboard**: comprehensive control center to manage minimum contributions, allow/ban tokens, and withdraw funds securely.
-   **Zero-Knowledge Privacy**: Client-side processing architecture ensuring user data and private keys never leave the browser.
-   **Enterprise Security**: Strict physical separation of frontend and backend runtimes.
-   **Internal Transactions**: Detailed tracking of smart contract executions.
-   **Historical Pricing**: Accurate point-in-time valuation.
-   **Smart Layouts**: High-quality, printable PDF layout using Puppeteer.

## 🏗️ Architecture

This project uses a Workspace-based Monorepo structure:

```text
/
├── apps/
│   ├── web/                # [Next.js] Frontend (Vercel)
│   └── api/                # [Node.js] Backend (Render)
│
├── packages/
│   ├── domain/             # Shared Types & Schemas (Zero Runtime)
│   ├── contracts/          # Smart Contracts & Canonical ABIs
│   ├── database/           # Supabase Schema & Migrations
│   └── config/             # Shared Environment Constants
│
└── tools/                  # Deployment & Verification Scripts
```

### 🧠 Support System & Persistence
The "Show Your Support" feature uses a **Lightweight Persistent Indexing** strategy:
-   **Contributor Data**: Stored in a JSON database (`apps/web/src/data/contributors.json`) to allow incremental updates without a heavy SQL requirement.
-   **RPC Optimization**: Fetches logs using "Smart Ranges" (only the latest blocks) to respect Free Tier limits of Alchemy/Infura.
-   **Fallback**: Automatically degrades to public RPCs if private keys are missing.


## 🚀 Quick Start

### Prerequisites
-   Node.js v18+
-   Redis (for background jobs)
-   PostgreSQL

### Installation

1.  **Clone and Install**:
    ```bash
    git clone <repository-url>
    cd chain-receipt
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
-   [Security Audit](security_audit.md): Details on the security architecture.

## 📄 License

Private. All rights reserved.
