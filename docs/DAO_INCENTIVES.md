# DAO Incentive Model

## Roles & Rewards

| Role | Primary Actions | Reward Signal |
|------|-----------------|---------------|
| Suggestion Scout | Submit high-quality market ideas | Upvotes, approval rate, Creator role candidacy |
| Reviewer | Score suggestions, approve markets | Reputation points, seasonal reviewer rewards |
| Market Creator | Publish curated markets | Share in platform fees after successful settlement |
| Resolver | Deliver verified outcomes | Performance bonuses tied to accuracy |
| Oracle Manager | Maintain oracle configuration | Fixed stipend + uptime bonuses |

## Reputation → Token Flow (Roadmap)
1. **Earn Points:** Suggestions approved (+5), accurate resolutions (+3), DAO tasks (+2).
2. **Epoch Settlement:** Points convert into governance weight and reward pool shares.
3. **Role Progression:** Consistent contributors auto-qualify for Market Creator / Reviewer tiers.

## Anti-Spam & Quality Guarantees
- Suggestions require DAO approval before publication.
- Voting history is logged; repeated low-signal suggestions lower reputation.
- Role changes are gated behind Admin multi-sig.

## Implementation Hooks
- Votes and events are captured via `suggestionsService` for future analytics export.
- Role management UI triggers on-chain transactions, enabling token-based gating in future upgrades.

