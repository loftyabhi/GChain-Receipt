# Deployment & Infrastructure Guide

This guide outlines the infrastructure requirements and steps to deploy the Chain Receipt system in its Monorepo configuration.

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
    NEXT_PUBLIC_API_URL=https://your-api.onrender.com
    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...
    
    # Show Your Support System
    NEXT_PUBLIC_SUPPORT_VAULT_ADDRESS=0x...
    NEXT_PUBLIC_ADMIN_ADDRESS=0x...
    NEXT_PUBLIC_ALCHEMY_API_KEY=...  # Optional: For high-performance indexing
    ```

## 2. Backend (Render / Railway)

The backend is a Node.js/Express application located in `apps/api`.

-   **Platform**: Render (Web Service)
-   **Runtime**: Node
-   **Root Directory**: `.` (Repository Root)
    -   *Reason*: Render needs to see the root `package.json` to install workspace dependencies (`packages/*`).
-   **Build Command**:
    ```bash
    npm install && npm run build -w apps/api
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
    REDIS_URL=...
    ALCHEMY_API_KEY=...
    PRIVATE_KEY=...
    ```

## 3. Database (Supabase)

-   **Schema Management**:
    -   Migrations are located in `packages/database/migrations`.
    -   Apply using Supabase CLI or copy SQL from `packages/database/migrations/schema.sql`.

## 4. Smart Contracts (Base Network)

-   **Location**: `packages/contracts`
-   **Deploy**:
    ```bash
    cd packages/contracts
    npx hardhat run scripts/deploy.ts --network base
    ```
-   **Update**: After deployment, update `packages/contracts/src/index.ts` with the new address and ABI.

## 5. Security Notes

-   **PDF Generation**: The API generates PDFs to `apps/api/public/bills`. Ensure your deployment platform supports ephemeral disk or configure S3 (Recommended for production).
-   **Secrets**: Never add `.env` files to `packages/*`. All secrets must be injected at the App level (`apps/web` or `apps/api`).
