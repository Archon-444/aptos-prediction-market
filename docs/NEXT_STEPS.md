# Next Steps Roadmap

This document captures the remaining work required to take the DAO tooling and backend live. Use it as a working checklist as you progress through backend deployment and multi-chain integration.

## Backend Bring-Up (Short Term)

1. **Install & Configure Backend**
   - `cd backend && npm install`
   - Copy `.env.example` to `.env` with Postgres credentials, module addresses, and network selections.
   - Run `npx prisma migrate dev --name init` to seed tables.
   - Start the API locally with `npm run dev`.

2. **Swap Frontend to REST API**
   - Update `dapp/src/services/suggestionsApi.ts` (and related services) to call `http://localhost:4000/api/*` instead of localStorage shims.
   - Smoke-test suggestion submission, admin review, and role management end-to-end against the new API.

3. **Blockchain Adapter Implementation**
   - Flesh out `backend/src/blockchain/aptos/aptosClient.ts` with real payloads for `createMarket`, `grantRole`, `revokeRole`.
   - Implement the equivalent logic for Sui in `backend/src/blockchain/sui/suiClient.ts`.
   - Store any custodial keys or signing configs securely (e.g., environment variables or a secrets manager).

## Production Hardening

- **Docker & CI**: Add a Dockerfile and GitHub Actions workflow to lint, test, and build the backend.
- **Observability**: Integrate structured logging sinks (Datadog, CloudWatch) and uptime monitoring.
- **Auth Hardening**: Expand wallet signature checks (nonce replay protection, timestamp verification) and consider JWT sessions for UI convenience.
- **Rate Limiting**: Tune `express-rate-limit` defaults once real traffic patterns are understood.

## Multi-Chain Rollout

- **Indexing Service**: Build a worker that watches Aptos/Sui events and backfills the `markets` table.
- **Config Management**: Introduce chain-specific config files (RPC URLs, module IDs) and document the process for adding a new chain.
- **Testnets**: Verify adapters using Aptos testnet & Sui testnet deployments before aiming at mainnet.

## Documentation & Testing

- Update `docs/DAO_TOOLING_OVERVIEW.md` once the backend is wired in (replace localStorage notes with REST references).
- Add Vitest + Supertest suites for each controller (`suggestions`, `roles`, `markets`).
- Produce developer onboarding notes for running both frontend and backend together.

Keep this roadmap updated as milestones are completed.

