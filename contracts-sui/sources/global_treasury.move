/// Global treasury module for unified liquidity management.
/// Provides deposit, claim recording, and redemption logic with solvency checks.
#[allow(duplicate_alias)]
module prediction_market::global_treasury {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::object;
    use sui::object::{ID, UID};
    use circle_usdc::usdc::USDC;
    use sui::table::{Self, Table};
    use sui::tx_context;
    use sui::tx_context::TxContext;
    use sui::transfer;

    use prediction_market::access_control::AdminCap;

    /// Error codes.
    const E_UNAUTHORIZED: u64 = 0x1002;
    const E_UNDERCOLLATERALIZED: u64 = 0x1003;
    const E_REDEMPTIONS_PAUSED: u64 = 0x1004;
    const E_INVARIANT_VIOLATION: u64 = 0x1005;
    const E_REENTRANCY: u64 = 0x1006;

    /// Internal claim record stored in the treasury table.
    public struct ClaimRecord has store, drop {
        user: address,
        amount: u64,
        market_id: ID,
    }

    /// Treasury holds all protocol liquidity and pending liabilities.
    public struct GlobalTreasury has key {
        id: UID,
        total_liquidity: Balance<USDC>,
        pending_claims: Table<ID, ClaimRecord>,
        total_claims_outstanding: u64,
        protocol_fees_collected: u64,
        redemptions_paused: bool,
        reentrancy_guard: bool,
    }

    /// Claim ticket issued to the winning user. This resource can be redeemed
    /// independently for USDC from the treasury.
    public struct ClaimTicket has key, store {
        id: UID,
        amount: u64,
        market_id: ID,
        user: address,
        created_epoch: u64,
    }

    /// Initialize the global treasury. Should be invoked from package init.
    fun init(ctx: &mut TxContext) {
        let treasury = GlobalTreasury {
            id: object::new(ctx),
            total_liquidity: balance::zero<USDC>(),
            pending_claims: table::new<ID, ClaimRecord>(ctx),
            total_claims_outstanding: 0,
            protocol_fees_collected: 0,
            redemptions_paused: false,
            reentrancy_guard: false,
        };

        transfer::share_object(treasury);
    }

    /// Allow LPs or operators to deposit USDC into the treasury.
    public fun deposit_liquidity(
        treasury: &mut GlobalTreasury,
        deposit: Coin<USDC>,
    ) {
        balance::join(&mut treasury.total_liquidity, coin::into_balance(deposit));

        // After deposit the solvency invariant must hold.
        assert!(
            balance::value(&treasury.total_liquidity) >= treasury.total_claims_outstanding,
            E_UNDERCOLLATERALIZED
        );
    }

    /// Record a claim for a market winner and mint a user-owned ticket.
    public fun record_claim(
        treasury: &mut GlobalTreasury,
        market_id: ID,
        user: address,
        amount: u64,
        ctx: &mut TxContext,
    ): ClaimTicket {
        assert!(!treasury.reentrancy_guard, E_REENTRANCY);
        treasury.reentrancy_guard = true;

        treasury.total_claims_outstanding = treasury.total_claims_outstanding + amount;

        let ticket = ClaimTicket {
            id: object::new(ctx),
            amount,
            market_id,
            user,
            created_epoch: tx_context::epoch(ctx),
        };
        let ticket_id = object::uid_to_inner(&ticket.id);

        table::add(
            &mut treasury.pending_claims,
            ticket_id,
            ClaimRecord { user, amount, market_id },
        );

        // Invariant: liquidity must still cover outstanding claims.
        assert!(
            balance::value(&treasury.total_liquidity) >= treasury.total_claims_outstanding,
            E_UNDERCOLLATERALIZED
        );

        treasury.reentrancy_guard = false;

        ticket
    }

    // spec record_claim {
    //     ensures !treasury.reentrancy_guard;
    //     ensures result.amount == amount;
    //     ensures treasury.total_claims_outstanding == old(treasury.total_claims_outstanding) + amount;
    // }

    /// Redeem a claim ticket for USDC. Only the ticket owner may redeem.
    public fun redeem_claim(
        treasury: &mut GlobalTreasury,
        ticket: ClaimTicket,
        ctx: &mut TxContext,
    ): Coin<USDC> {
        assert!(!treasury.redemptions_paused, E_REDEMPTIONS_PAUSED);
        assert!(!treasury.reentrancy_guard, E_REENTRANCY);
        treasury.reentrancy_guard = true;

        let ClaimTicket { id, amount, market_id: _, user, created_epoch: _ } = ticket;
        let ticket_id = object::uid_to_inner(&id);

        let record = table::remove(&mut treasury.pending_claims, ticket_id);
        // Ensure the claim existed.
        let ClaimRecord { user: recorded_user, amount: recorded_amount, market_id: _ } = record;
        assert!(recorded_amount == amount, E_INVARIANT_VIOLATION);
        assert!(recorded_user == user, E_UNAUTHORIZED);

        // Ensure sender owns the ticket.
        assert!(tx_context::sender(ctx) == user, E_UNAUTHORIZED);

        treasury.total_claims_outstanding = treasury.total_claims_outstanding - amount;

        let payout = coin::take(&mut treasury.total_liquidity, amount, ctx);

        object::delete(id);

        assert!(
            balance::value(&treasury.total_liquidity) >= treasury.total_claims_outstanding,
            E_INVARIANT_VIOLATION
        );

        treasury.reentrancy_guard = false;

        payout
    }

    // spec redeem_claim {
    //     ensures !treasury.reentrancy_guard;
    // }

    /// Entry wrapper so callers can deposit native USDC via transaction.
    public entry fun deposit_liquidity_entry(
        treasury: &mut GlobalTreasury,
        deposit: Coin<USDC>
    ) {
        deposit_liquidity(treasury, deposit);
    }

    /// Entry wrapper that redeems the claim ticket and transfers the SUI payout to sender.
    public entry fun redeem_claim_entry(
        treasury: &mut GlobalTreasury,
        ticket: ClaimTicket,
        ctx: &mut TxContext
    ) {
        let payout = redeem_claim(treasury, ticket, ctx);
        transfer::public_transfer(payout, tx_context::sender(ctx));
    }

    /// Pause user redemptions (admin controlled) in emergencies.
    public fun pause_redemptions(_cap: &AdminCap, treasury: &mut GlobalTreasury) {
        treasury.redemptions_paused = true;
    }

    /// Resume user redemptions after emergency.
    public fun resume_redemptions(_cap: &AdminCap, treasury: &mut GlobalTreasury) {
        treasury.redemptions_paused = false;
    }

    /// View helper: returns total USDC liquidity in treasury.
    public fun total_liquidity(treasury: &GlobalTreasury): u64 {
        balance::value(&treasury.total_liquidity)
    }

    /// View helper: returns total outstanding claims.
    public fun total_claims(treasury: &GlobalTreasury): u64 {
        treasury.total_claims_outstanding
    }

    /// View helper: check if redemptions are paused.
    public fun is_paused(treasury: &GlobalTreasury): bool {
        treasury.redemptions_paused
    }

    // ===== Test-only helpers =====

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext): GlobalTreasury {
        GlobalTreasury {
            id: object::new(ctx),
            total_liquidity: balance::zero<USDC>(),
            pending_claims: table::new<ID, ClaimRecord>(ctx),
            total_claims_outstanding: 0,
            protocol_fees_collected: 0,
            redemptions_paused: false,
            reentrancy_guard: false,
        }
    }

    #[test_only]
    public fun destroy_treasury(treasury: GlobalTreasury) {
        let GlobalTreasury {
            id,
            total_liquidity,
            pending_claims,
            total_claims_outstanding: _,
            protocol_fees_collected: _,
            redemptions_paused: _,
            reentrancy_guard: _,
        } = treasury;

        table::destroy_empty(pending_claims);
        balance::destroy_zero(total_liquidity);
        object::delete(id);
    }

    #[test_only]
    public fun destroy_claim_ticket(ticket: ClaimTicket) {
        let ClaimTicket { id, amount: _, market_id: _, user: _, created_epoch: _ } = ticket;
        object::delete(id);
    }

    #[test_only]
    public fun share_for_testing(treasury: GlobalTreasury) {
        transfer::share_object(treasury);
    }

}
