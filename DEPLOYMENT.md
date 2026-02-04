# Deployment & Infrastructure Guide

This guide outlines the infrastructure requirements and steps to deploy the TxProof system in its Monorepo configuration.

## 1. Frontend (Vercel)

The frontend is a Next.js application located in `apps/web`.

-   **Platform**: Vercel
-   **Framework Preset**: Next.js
-   **Root Directory**: `apps/web`
    -   *Critical*: You MUST set the Root Directory in Vercel settings so it ignores the backend.
-   **Build Command**: `npm run build`
    -   (Vercel will automatically detect `cd ../.. && npm install` logic for monorepos).
-   **Environment Variables**:
    ```ini
    NEXT_PUBLIC_API_URL=https://api.txproof.xyz
    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...
    
    # Analytics & Privacy (New)
    NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
    NEXT_PUBLIC_CONSENT_MODE=true
    
    # Show Your Support System
    NEXT_PUBLIC_SUPPORT_VAULT_ADDRESS=0x...
    NEXT_PUBLIC_ADMIN_ADDRESS=0x...
    
    # Supabase (Required for Contributor Caching & Bill Status)
    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
    
    # Routing (Microfrontends)
    DOCS_URL=https://docs.txproof.xyz
    DEVELOPER_PORTAL_URL=https://txproof.xyz/developers
    ```

## 2. Backend (Render / Railway)

The backend is a Node.js/Express application located in `apps/api`.

-   **Platform**: VPS / Cloud (e.g. AWS, DigitalOcean)
-   **Runtime**: Node
-   **Root Directory**: `.` (Repository Root)
    -   *Reason*: Render needs to see the root `package.json` to install workspace dependencies (`packages/*`).
-   **Build Command**:
    ```bash
    npm install -w @txproof/api --include-workspace-root --include=dev --no-audit --no-fund && npm run build -- --filter=@txproof/api
    ```
-   **Start Command**:
    ```bash
    npm start -w apps/api
    ```
-   **Environment Variables** (Add to Render Dashboard):
    ```ini
    NODE_ENV=production
    PORT=3000
    DATABASE_URL=...
    
    # Soft Queue Configuration (Free Tier Safe)
    MAX_CONCURRENT_JOBS=2
    JOB_PROCESSING_TIMEOUT_MINUTES=5
    BILL_AVG_PROCESS_TIME_SECONDS=6
    
    # Feature Flags (Resource Control)
    ENABLE_ENS=false
    ENABLE_INTERNAL_TX=false
    ENABLE_AUTO_CLEANUP=false

    # Keys
    ALCHEMY_API_KEY=...
    SUPABASE_URL=...
    SUPABASE_SERVICE_ROLE_KEY=...
    ```

## 3. Database (Supabase)

-   **Schema Management**:
    -   Migrations are located in `packages/database/migrations`.
    -   Apply using Supabase CLI or copy SQL from `packages/database/migrations/*.sql`.
    -   **Critical**: Ensure `02_soft_queue.sql` and `03_fix_soft_queue_schema.sql` are applied.

## 4. Smart Contracts (Base Network)

-   **Location**: `packages/contracts`
-   **Deploy**:
    ```bash
    cd packages/contracts
    npx hardhat run scripts/deploy.ts --network base
    ```
-   **Update**: After deployment, update `packages/contracts/src/index.ts` with the new address and ABI.

## 5. Security Notes

-   **Soft Queue**: The system uses a PostgreSQL-backed queue (`bill_jobs`) to manage load. This eliminates the need for Redis in critical paths.
-   **Secrets**: Never add `.env` files to `packages/*`. All secrets must be injected at the App level.

## 6. Wiring Services Together

### A. Connect Database to Backend (Supabase -> Render)

1.  **Get Connection String**:
    *   Go to your **Supabase Dashboard** -> Project Settings -> Database.
    *   Find "Connection String" -> Select "Node.js" -> Copy the **Transaction Mode** (Pooler) string (port 6543).
    *   *Note*: For serverless/cloud environments, the Transaction Pooler (port 6543) is **REQUIRED** to prevent connection limit errors.
    *   Format: `postgres://[user]:[password]@[host]:6543/[db_name]?pooler=transaction`
2.  **Set Variable in Render**:
    *   Go to your **Render Dashboard** -> Select your API Web Service -> Environment.
    *   Add/Update `DATABASE_URL` with the string you copied.

### B. Connect Backend to Frontend (Render -> Vercel)

1.  **Get Backend URL**:
    *   Get your deployed backend URL (e.g., `https://api.txproof.xyz`).
2.  **Set Variable in Vercel**:
    *   Go to your **Vercel Dashboard** -> Select your Project -> Settings -> Environment Variables.
    *   Add/Update `NEXT_PUBLIC_API_URL` with the Render URL.

### C. Web3 & External Services

1.  **WalletConnect (Reown)**:
    *   Go to [Reown Cloud](https://cloud.reown.com/).
    *   Create a project and copy the **Project ID**.
    *   In **Vercel**, set `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`.
2.  **Alchemy (RPC)**:
    *   Go to [Alchemy Dashboard](https://dashboard.alchemy.com/).
    *   Create a new App (Base Mainnet).
    *   Copy the **API Key**.
    *   In **Render**, set `ALCHEMY_API_KEY`.

### D. Final Check

1.  **Redeploy Backend**: If you changed Render variables, go to "Manual Deploy" -> "Deploy latest commit".
2.  **Redeploy Frontend**: If you changed Vercel variables, go to "Deployments" -> Redeploy your latest build.
