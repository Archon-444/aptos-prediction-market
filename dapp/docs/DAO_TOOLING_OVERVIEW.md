# DAO Tooling Architecture

This document describes the curated market workflow introduced in the October 2025 refactor, the data model that backs it, and how the UI components interact with on-chain roles.

## Components

| Layer | File | Responsibility |
|-------|------|----------------|
| Storage | `src/services/suggestionsService.ts` | Local-first repository for suggestions, votes, and activity events. Can be swapped for a REST API by replacing the read/write helpers. |
| API Facade | `src/services/suggestionsApi.ts` | Async wrappers (with artificial latency) used by React pages. Replace these functions with `fetch` calls once the backend is live. |
| Creation UI | `src/pages/CreateMarketPage.tsx` | Dual-mode (suggestion/creator) form that submits proposals or on-chain markets depending on the connected wallet’s role. |
| Review UI | `src/pages/AdminSuggestionsPage.tsx` | DAO console for upvoting, approving, or rejecting suggestions. Shows a live timeline based on stored events. |
| Role Management | `src/pages/AdminRolesPage.tsx` | Admin-only console to grant/revoke roles via the wallet adapter. Uses `useRoleManagement` to build and sign payloads. |
| DAO Overview | `src/pages/DaoOverviewPage.tsx` | Documentation-driven landing page that anchors the governance workflow and incentive model. |

## Data Model

### Suggestions
```ts
type MarketSuggestionStatus = 'pending' | 'approved' | 'rejected';

interface MarketSuggestion {
  id: string;
  proposer: string;
  question: string;
  outcomes: string[];
  category: string;
  resolutionSource?: string;
  durationHours: number;
  status: MarketSuggestionStatus;
  votes: number;
  reviewer?: string;
  reviewReason?: string;
  txHash?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
}
```

### Events
```ts
type SuggestionEventType = 'submitted' | 'approved' | 'rejected' | 'vote';

interface SuggestionEvent {
  id: string;
  suggestionId: string;
  type: SuggestionEventType;
  actor: string; // proposer, reviewer, or 'community'
  timestamp: string;
  metadata?: Record<string, any>;
}
```

Events are appended whenever:

- A suggestion is submitted (`submitted`).
- DAO reviewers approve or reject (`approved` / `rejected`).
- Community members upvote (`vote` with delta +1).

## Role Enforcement

| Role ID | Enum | Access |
|---------|------|--------|
| 0 | `RoleId.Admin` | Access to `/admin/roles` and `/admin/suggestions`; can grant/revoke roles. |
| 1 | `RoleId.MarketCreator` | Unlocks “Create Market” mode on `/create`; bypasses suggestion queue. |
| 2 | `RoleId.Resolver` | Future use for resolution tooling. |
| 3 | `RoleId.OracleManager` | Future use for oracle maintenance console. |
| 4 | `RoleId.Pauser` | Emergency controls. |

Role lookups call `access_control::has_role` via `useRoleCheck`. Grants/revocations build Move payloads with the connected wallet.

## Swap-in Backend Strategy

1. Replace `readSuggestions / writeSuggestions` with REST calls (`GET /api/suggestions`, `POST`, `PATCH`).
2. Replace `readEvents / writeEvents` similarly.
3. Remove artificial delays from `suggestionsApi` once real network latency exists.
4. Keep the hook and component APIs identical so React code does not change.

## Testing Notes

- `src/__tests__/suggestionsService.test.ts` verifies creation, approval, and votes, covering both data mutations and event logging.
- Additional integration tests can stub `suggestionsApi` to assert UI behavior (TODO).

