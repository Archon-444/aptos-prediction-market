#[allow(duplicate_alias, lint(public_entry), unused_const)]
module prediction_market::market_manager {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use circle_usdc::usdc::USDC;
    use std::string::{Self, String};
    use std::vector;

    // ===== Error Codes =====
    const E_MARKET_EXPIRED: u64 = 1;
    const E_MARKET_NOT_EXPIRED: u64 = 2;
    const E_MARKET_ALREADY_RESOLVED: u64 = 3;
    const E_INVALID_OUTCOME: u64 = 4;
    const E_INSUFFICIENT_BALANCE: u64 = 5;
    const E_NO_POSITION: u64 = 6;
    const E_MARKET_PAUSED: u64 = 7;
    const E_UNAUTHORIZED: u64 = 8;
    const E_INVALID_DURATION: u64 = 9;

    // ===== Structs =====

    /// Market object (shared - multiple users can interact)
    public struct Market has key, store {
        id: UID,
        question: String,
        outcomes: vector<String>,
        end_timestamp: u64,
        yes_pool: Balance<USDC>,
        no_pool: Balance<USDC>,
        total_yes_shares: u64,
        total_no_shares: u64,
        status: u8, // 0 = active, 1 = resolved, 2 = disputed, 3 = cancelled
        resolved_outcome: u8, // 0 = no, 1 = yes, 255 = unresolved
        creator: address,
        resolution_source: String,
        liquidity_param: u64,
        paused: bool,
    }

    /// User position (owned - user controls)
    public struct Position has key, store {
        id: UID,
        market_id: ID,
        outcome: u8, // 0 = no, 1 = yes
        shares: u64,
        amount_invested: u64,
        owner: address,
    }

    /// Admin capability for market operations
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Resolver capability for market resolution
    public struct ResolverCap has key, store {
        id: UID,
    }

    // ===== Events =====

    public struct MarketCreated has copy, drop {
        market_id: ID,
        creator: address,
        question: String,
        end_timestamp: u64,
    }

    public struct BetPlaced has copy, drop {
        market_id: ID,
        bettor: address,
        outcome: u8,
        amount: u64,
        shares_received: u64,
    }

    public struct MarketResolved has copy, drop {
        market_id: ID,
        resolver: address,
        winning_outcome: u8,
        total_volume: u64,
    }

    public struct WinningsClaimed has copy, drop {
        market_id: ID,
        user: address,
        amount: u64,
    }

    // ===== Initialization =====

    /// Module initializer - creates admin capability
    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };

        let resolver_cap = ResolverCap {
            id: object::new(ctx),
        };

        // Transfer admin cap to deployer
        transfer::transfer(admin_cap, tx_context::sender(ctx));
        transfer::transfer(resolver_cap, tx_context::sender(ctx));
    }

    // ===== Public Entry Functions =====

    /// Create a new prediction market
    public entry fun create_market(
        question: vector<u8>,
        outcomes: vector<vector<u8>>,
        duration_hours: u64,
        resolution_source: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(duration_hours > 0 && duration_hours <= 8760, E_INVALID_DURATION); // Max 1 year

        let current_time = clock::timestamp_ms(clock);
        let end_timestamp = current_time + (duration_hours * 3600 * 1000);

        // Convert outcomes to Strings
        let mut string_outcomes = vector::empty<String>();
        let mut i = 0;
        let len = vector::length(&outcomes);
        while (i < len) {
            let outcome_bytes = vector::borrow(&outcomes, i);
            vector::push_back(&mut string_outcomes, string::utf8(*outcome_bytes));
            i = i + 1;
        };

        let market_id = object::new(ctx);
        let market_id_val = object::uid_to_inner(&market_id);

        let market = Market {
            id: market_id,
            question: string::utf8(question),
            outcomes: string_outcomes,
            end_timestamp,
        yes_pool: balance::zero<USDC>(),
        no_pool: balance::zero<USDC>(),
            total_yes_shares: 0,
            total_no_shares: 0,
            status: 0, // Active
            resolved_outcome: 255, // Unresolved
            creator: tx_context::sender(ctx),
            resolution_source: string::utf8(resolution_source),
            liquidity_param: 100, // Default liquidity parameter for LMSR
            paused: false,
        };

        event::emit(MarketCreated {
            market_id: market_id_val,
            creator: tx_context::sender(ctx),
            question: string::utf8(question),
            end_timestamp,
        });

        transfer::share_object(market);
    }

    /// Place a bet on a market outcome
    public entry fun place_bet(
        market: &mut Market,
        payment: Coin<USDC>,
        outcome: u8,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validations
        assert!(!market.paused, E_MARKET_PAUSED);
        assert!(market.status == 0, E_MARKET_ALREADY_RESOLVED);
        assert!(clock::timestamp_ms(clock) < market.end_timestamp, E_MARKET_EXPIRED);
        assert!(outcome == 0 || outcome == 1, E_INVALID_OUTCOME);

        let amount = coin::value(&payment);
        assert!(amount > 0, E_INSUFFICIENT_BALANCE);

        let balance_to_add = coin::into_balance(payment);

        // Calculate shares using simple proportional method
        // In production, this would use LMSR or another AMM formula
        let shares = calculate_shares(market, outcome, amount);

        // Update market pools and shares
        if (outcome == 1) {
            balance::join(&mut market.yes_pool, balance_to_add);
            market.total_yes_shares = market.total_yes_shares + shares;
        } else {
            balance::join(&mut market.no_pool, balance_to_add);
            market.total_no_shares = market.total_no_shares + shares;
        };

        // Create position for user
        let position = Position {
            id: object::new(ctx),
            market_id: object::uid_to_inner(&market.id),
            outcome,
            shares,
            amount_invested: amount,
            owner: tx_context::sender(ctx),
        };

        event::emit(BetPlaced {
            market_id: object::uid_to_inner(&market.id),
            bettor: tx_context::sender(ctx),
            outcome,
            amount,
            shares_received: shares,
        });

        transfer::transfer(position, tx_context::sender(ctx));
    }

    /// Resolve a market (requires ResolverCap)
    public entry fun resolve_market(
        _cap: &ResolverCap,
        market: &mut Market,
        winning_outcome: u8,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(clock::timestamp_ms(clock) >= market.end_timestamp, E_MARKET_NOT_EXPIRED);
        assert!(market.status == 0, E_MARKET_ALREADY_RESOLVED);
        assert!(winning_outcome == 0 || winning_outcome == 1, E_INVALID_OUTCOME);

        market.status = 1; // Resolved
        market.resolved_outcome = winning_outcome;

        let total_volume = balance::value(&market.yes_pool) + balance::value(&market.no_pool);

        event::emit(MarketResolved {
            market_id: object::uid_to_inner(&market.id),
            resolver: tx_context::sender(ctx),
            winning_outcome,
            total_volume,
        });
    }

    /// Claim winnings from a resolved market
    public entry fun claim_winnings(
        market: &mut Market,
        position: Position,
        ctx: &mut TxContext
    ) {
        assert!(market.status == 1, E_MARKET_ALREADY_RESOLVED);
        assert!(object::uid_to_inner(&market.id) == position.market_id, E_NO_POSITION);

        let Position { id, market_id: _, outcome, shares, amount_invested: _, owner } = position;
        object::delete(id);

        // Only winning positions can claim
        if (outcome != market.resolved_outcome) {
            return
        };

        // Calculate payout
        let total_pool = balance::value(&market.yes_pool) + balance::value(&market.no_pool);
        let winning_pool = if (outcome == 1) { &mut market.yes_pool } else { &mut market.no_pool };
        let winning_shares = if (outcome == 1) { market.total_yes_shares } else { market.total_no_shares };

        if (winning_shares == 0) {
            return
        };

        // Proportional payout based on shares
        let payout = (total_pool * shares) / winning_shares;

        if (payout > 0 && payout <= balance::value(winning_pool)) {
            let payout_balance = balance::split(winning_pool, payout);
            let payout_coin = coin::from_balance(payout_balance, ctx);

            event::emit(WinningsClaimed {
                market_id: object::uid_to_inner(&market.id),
                user: owner,
                amount: payout,
            });

            transfer::public_transfer(payout_coin, owner);
        };
    }

    /// Pause a market (admin only)
    public entry fun pause_market(
        _cap: &AdminCap,
        market: &mut Market,
    ) {
        market.paused = true;
    }

    /// Unpause a market (admin only)
    public entry fun unpause_market(
        _cap: &AdminCap,
        market: &mut Market,
    ) {
        market.paused = false;
    }

    // ===== View Functions =====

    /// Get market details
    public fun get_market_info(market: &Market): (String, u64, u8, u8) {
        (market.question, market.end_timestamp, market.status, market.resolved_outcome)
    }

    /// Get market pools
    public fun get_market_pools(market: &Market): (u64, u64) {
        (balance::value(&market.yes_pool), balance::value(&market.no_pool))
    }

    // ===== Internal Functions =====

    /// Calculate shares for a bet (simplified version)
    /// In production, implement LMSR or other AMM formulas
    fun calculate_shares(market: &Market, outcome: u8, amount: u64): u64 {
        // Simple 1:1 shares for now
        // TODO: Implement LMSR formula
        let _market = market;
        let _outcome = outcome;
        amount
    }

    // ===== Test Functions =====
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
