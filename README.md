# Move Market

Move Market is a dual-chain (Aptos + Sui) prediction market that is mid-way through MVP development. The codebase includes Move smart contracts, a TypeScript/React dApp, and a Node/Prisma backend. The project is **not production ready**—core security work, USDC plumbing, and oracle integration remain in progress.

## 🎯 Project Status (May 2025)

| Area | Completion | Notes |
| --- | --- | --- |
| Aptos contracts & flows | ~60% | Market lifecycle and betting implemented; reentrancy guards, atomic resolution, and native USDC still missing |
| Sui contracts & flows | ~45% | Sharded pool model in place; needs USDC routing, settlement queue validation, and full QA |
| Backend (Express/Prisma) | ~55% | REST endpoints, auth scaffolding, and indexer shell exist; chain-aware payout logic & RBAC incomplete |
| Frontend (React/Vite) | ~60% | Dual-chain wallet UI, market views, and betting modal working; create/resolve flows and payouts not wired end-to-end |
| Operations & Security | ~30% | Runbooks drafted, but no monitoring deployment, audit engagement, or incident drills completed |

**Key Reality Checks**
- Smart contracts have not been audited; critical safety mechanisms (reentrancy guard, atomic resolution) are partially implemented or stubbed.
- “USDC integration” is presently a dev shim. Real Circle/LayerZero plumbing has not started.
- Oracle stack (Pyth + optimistic fallback) is in documentation but not integrated.
- Token launch, governance, and Sui parity are deferred until the Aptos/Sui MVP is secure.

### ✅ What Works Today
- Basic market creation, betting, and claim flows on local/test environments.
- TypeScript SDKs for Aptos (MoveMarketSDK) with unit helpers.
- Dual wallet selector (Aptos Connect + Sui Connect) and chain switch UX.
- Documentation set (architecture notes, runbooks, audit prep) capturing intended design.

### 🚧 Critical Gaps Blocking MVP
- Native USDC deposits/withdrawals on both chains.
- Oracle selection + integration (Pyth primary, optimistic backup).
- Contract hardening: reentrancy guards, atomic resolution, RBAC, pause controls.
- Backend payout/settlement parity for Sui, chain-aware indexing, and RBAC.
- Comprehensive testing (integration, load, fuzz) and external security audit.

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- Rust (latest stable)
- Aptos CLI & Sui CLI
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/move-market.git
cd move-market

# Install frontend (React/Vite app)
cd dapp
npm install

# Install backend (Express/Prisma)
cd ../backend
npm install

# Configure Move toolchains
aptos init --network devnet
sui client active-address # ensure a devnet address exists
```

### Development

```bash
# Start backend API (port 3001)
npm run dev --prefix backend

# Start frontend (port 5173)
npm run dev --prefix dapp

# Run Aptos contract tests
cd contracts
aptos move test

# Run Sui contract tests
cd ../contracts-sui
sui move test
```

---

## 📁 Repository Structure

```
move-market/
├── contracts/            # Aptos Move package
├── contracts-sui/        # Sui Move package (shared-object design)
├── backend/              # Express/Prisma API + indexer
├── dapp/                 # React app (Vite, TanStack Query)
├── docs/                 # Architecture, audits, runbooks
├── monitoring/           # Prometheus/Grafana manifests
└── scripts/              # Deployment utilities
```

---

## 📖 Documentation

- **[ARCHITECTURE_DECOUPLED.md](ARCHITECTURE_DECOUPLED.md)** – High-level system design
- **[COMPREHENSIVE_AUDIT_REPORT_OCT2025.md](COMPREHENSIVE_AUDIT_REPORT_OCT2025.md)** – Strategic & security audit
- **[DEPLOYMENT_RUNBOOK.md](docs/runbooks/DEPLOYMENT_RUNBOOK.md)** – Ops checklist (needs validation)
- **[INCIDENT_RESPONSE_RUNBOOK.md](docs/runbooks/INCIDENT_RESPONSE_RUNBOOK.md)** – Draft incident plan
- **[MoveMarketSDK](dapp/src/services/MoveMarketSDK.ts)** – Aptos TypeScript SDK
- **[Dual Chain Gap Checklist](docs/DUAL_CHAIN_GAP_CHECKLIST.md)** – (New) Aptos vs Sui work items

---

## 🛠️ Current Focus Areas

1. **Security Hardening** – Implement reentrancy guards, atomic resolution, and BFT-safe oracle handling on both chains.
2. **USDC Integration** – Replace dev shims with real Circle/LayerZero flows, add settlement queue enforcement on Sui.
3. **Backend Parity** – Ensure payout calculations, indexing, and RBAC are chain-aware.
4. **Testing & Observability** – Integration tests, load tests, Prometheus/Grafana deployment, and audit readiness.
5. **Documentation Accuracy** – Keep project status, scope, and roadmap truthful; defer token/governance until after MVP launch.

---

## 🔐 Security

- Move-based contracts provide strong safety primitives, but **critical guardrails are incomplete**.
- No external audit has been scheduled yet; budget and vendor selection are outstanding.
- Formal specs exist in draft form; they must be finished and run through Move Prover.
- Bug bounty, compliance policies, and monitoring will be defined post-audit.

**Security contact**: security@movemarket.app

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please review [CONTRIBUTING.md](CONTRIBUTING.md). Before submitting PRs, familiarise yourself with the dual-chain backlog and security priorities.

---

## 🔧 Environment Variables

Key variables required for local development (see `.env.example` for full list):

| Variable | Description |
| --- | --- |
| `VITE_APTOS_NETWORK` | Aptos network (`devnet`, `testnet`, `mainnet`) |
| `VITE_APTOS_MODULE_ADDRESS` | Published Move package address on Aptos |
| `VITE_APTOS_USDC_ADDRESS` | Native USDC coin address on Aptos |
| `VITE_SUI_NETWORK` | Sui network (`devnet`, `testnet`, `mainnet`) |
| `VITE_SUI_PACKAGE_ID` | Published Move package ID on Sui |
| `VITE_SUI_USDC_COIN_TYPE` | Native Circle USDC coin type on Sui (e.g., `0x...::coin::COIN`) |

> ⚠️ Keep `.env` out of version control. Populate the USDC entries with the actual coin types created via your Circle testnet accounts.

---

## Sui Native USDC

This project targets Circle-issued native USDC on Sui. Default configuration points to **testnet**:

```
0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC
```

When deploying to mainnet, update the relevant environment variables to:

```
0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC
```

> 🚫 Bridged `wUSDC` (`0x5d4b3025…::coin::COIN`) is **not** supported. Users should migrate via Circle’s official guide before interacting with Move Market.

See [docs/SUI_NATIVE_USDC.md](docs/SUI_NATIVE_USDC.md) for details.

---

## 🔗 Links

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/aptos-prediction-market/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/aptos-prediction-market/discussions)

---

**Built with ❤️ on Aptos & Sui | Powered by Move**
