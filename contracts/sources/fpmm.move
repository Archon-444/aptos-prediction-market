/// FPMM (Fixed Product Market Maker) Implementation
/// Implements constant product formula: x × y = k
/// Optimized for binary prediction markets (Yes/No outcomes)
module prediction_market::fpmm {
    use std::error;

    friend prediction_market::betting;

    // Error codes
    const E_INVALID_OUTCOME: u64 = 1;
    const E_INVALID_AMOUNT: u64 = 2;
    const E_OVERFLOW: u64 = 3;
    const E_DIVISION_BY_ZERO: u64 = 4;
    const E_INSUFFICIENT_LIQUIDITY: u64 = 5;
    const E_SLIPPAGE_EXCEEDED: u64 = 6;
    const E_INVALID_POOL: u64 = 7;

    // Fixed-point precision (6 decimals to match USDC)
    const BASIS_POINTS: u64 = 10000; // 100% = 10000 basis points

    // Pool constraints
    const MIN_LIQUIDITY: u64 = 1000000;     // 1 USDC minimum
    const MAX_PRICE_IMPACT: u64 = 5000;      // 50% max price impact
    const MIN_PRICE: u64 = 100;              // 1% minimum price
    const MAX_PRICE: u64 = 9900;             // 99% maximum price

    // Fee configuration (30 bps)
    const FEE_DENOMINATOR: u64 = 10000;
    const TRADING_FEE_BPS: u64 = 30;

    // ==================== Data Structures ====================

    /// Pool state for a binary prediction market
    /// Invariant: reserve_yes × reserve_no = k (constant product)
    struct Pool has store, copy, drop {
        reserve_yes: u64,      // YES outcome reserve (in shares)
        reserve_no: u64,       // NO outcome reserve (in shares)
        liquidity: u64,        // Total liquidity provided (in USDC)
        total_volume: u64,     // Cumulative trading volume
        fee_accumulated: u64,  // Trading fees collected
    }

    // ==================== Core Functions ====================

    /// Create a new FPMM pool with initial liquidity
    /// Initializes with 50/50 split (50% probability for each outcome)
    public(friend) fun create_pool(initial_liquidity_usdc: u64): Pool {
        assert!(initial_liquidity_usdc >= MIN_LIQUIDITY, error::invalid_argument(E_INVALID_AMOUNT));

        // Start with balanced pool: 50% YES, 50% NO
        let reserve_yes = initial_liquidity_usdc / 2;
        let reserve_no = initial_liquidity_usdc / 2;

        Pool {
            reserve_yes,
            reserve_no,
            liquidity: initial_liquidity_usdc,
            total_volume: 0,
            fee_accumulated: 0,
        }
    }

    /// Get current price for an outcome (in basis points)
    /// Price(YES) = reserve_no / (reserve_yes + reserve_no)
    /// Price(NO) = reserve_yes / (reserve_yes + reserve_no)
    /// Returns: price in basis points (10000 = 100%)
    public fun get_price(pool: &Pool, outcome: u8): u64 {
        assert!(outcome <= 1, error::invalid_argument(E_INVALID_OUTCOME));
        assert!(pool.reserve_yes > 0 && pool.reserve_no > 0, error::invalid_state(E_INVALID_POOL));

        let total = pool.reserve_yes + pool.reserve_no;
        assert!(total > 0, error::invalid_state(E_DIVISION_BY_ZERO));

        let price = if (outcome == 0) {
            // YES price = reserve_no / total
            safe_mul_div(pool.reserve_no, BASIS_POINTS, total)
        } else {
            // NO price = reserve_yes / total
            safe_mul_div(pool.reserve_yes, BASIS_POINTS, total)
        };

        // Clamp price to [1%, 99%]
        if (price < MIN_PRICE) {
            MIN_PRICE
        } else if (price > MAX_PRICE) {
            MAX_PRICE
        } else {
            price
        }
    }

    /// Execute buy order using a cost amount; returns shares received
    public(friend) fun buy_with_cost(
        pool: &mut Pool,
        outcome: u8,
        amount_in: u64,
    ): u64 {
        let (new_pool, shares, _) = compute_buy(pool, outcome, amount_in);
        *pool = new_pool;
        shares
    }

    /// Preview share output for a given cost without mutating pool
    public fun preview_buy(
        pool: &Pool,
        outcome: u8,
        amount_in: u64,
    ): u64 {
        let (_, shares, _) = compute_buy(pool, outcome, amount_in);
        shares
    }

    fun compute_buy(
        pool: &Pool,
        outcome: u8,
        amount_in: u64,
    ): (Pool, u64, u64) {
        assert!(outcome <= 1, error::invalid_argument(E_INVALID_OUTCOME));
        assert!(amount_in > 0, error::invalid_argument(E_INVALID_AMOUNT));
        assert!(pool.reserve_yes > 0 && pool.reserve_no > 0, error::invalid_state(E_INVALID_POOL));

        let old_price = get_price(pool, outcome);
        let reserve_in = if (outcome == 0) {
            pool.reserve_no
        } else {
            pool.reserve_yes
        };
        let reserve_out = if (outcome == 0) {
            pool.reserve_yes
        } else {
            pool.reserve_no
        };

        let fee = (amount_in * TRADING_FEE_BPS) / FEE_DENOMINATOR;
        let net_in = amount_in - fee;
        assert!(net_in > 0, error::invalid_argument(E_INVALID_AMOUNT));

        let k_u128 = (reserve_in as u128) * (reserve_out as u128);
        let new_reserve_in_u128 = (reserve_in as u128) + (net_in as u128);
        assert!(new_reserve_in_u128 <= 18446744073709551615u128, error::out_of_range(E_OVERFLOW));
        let new_reserve_in = new_reserve_in_u128 as u64;

        let new_reserve_out_u128 = k_u128 / (new_reserve_in as u128);
        assert!(new_reserve_out_u128 > 0, error::invalid_argument(E_INSUFFICIENT_LIQUIDITY));
        assert!(new_reserve_out_u128 < (reserve_out as u128), error::invalid_argument(E_INSUFFICIENT_LIQUIDITY));
        let new_reserve_out = new_reserve_out_u128 as u64;

        let shares_u128 = (reserve_out as u128) - new_reserve_out_u128;
        assert!(shares_u128 > 0, error::invalid_argument(E_INSUFFICIENT_LIQUIDITY));
        assert!(shares_u128 <= 18446744073709551615u128, error::out_of_range(E_OVERFLOW));
        let shares = shares_u128 as u64;

        let updated_pool = Pool {
            reserve_yes: if (outcome == 0) { new_reserve_out } else { new_reserve_in },
            reserve_no: if (outcome == 0) { new_reserve_in } else { new_reserve_out },
            liquidity: pool.liquidity,
            total_volume: pool.total_volume + amount_in,
            fee_accumulated: pool.fee_accumulated + fee,
        };

        let new_price = get_price(&updated_pool, outcome);
        let impact = if (new_price > old_price) {
            new_price - old_price
        } else {
            old_price - new_price
        };
        assert!(impact <= MAX_PRICE_IMPACT, error::invalid_state(E_SLIPPAGE_EXCEEDED));

        (updated_pool, shares, fee)
    }

    // ==================== Helper Functions ====================

    /// Safe multiplication with overflow check
    fun safe_mul(a: u64, b: u64): u64 {
        if (a == 0 || b == 0) {
            return 0
        };

        let result_u128 = (a as u128) * (b as u128);
        let max_u64 = 18446744073709551615u128;

        assert!(result_u128 <= max_u64, error::out_of_range(E_OVERFLOW));
        (result_u128 as u64)
    }

    /// Safe multiplication and division: (a × b) / c
    fun safe_mul_div(a: u64, b: u64, c: u64): u64 {
        assert!(c > 0, error::invalid_argument(E_DIVISION_BY_ZERO));

        if (a == 0 || b == 0) {
            return 0
        };

        // Use u128 to prevent overflow
        let result = ((a as u128) * (b as u128)) / (c as u128);
        let max_u64 = 18446744073709551615u128;

        assert!(result <= max_u64, error::out_of_range(E_OVERFLOW));
        (result as u64)
    }

    // ==================== View Functions ====================

    /// Get all pool information
    public fun get_pool_info(pool: &Pool): (u64, u64, u64, u64, u64) {
        (
            pool.reserve_yes,
            pool.reserve_no,
            pool.liquidity,
            pool.total_volume,
            pool.fee_accumulated,
        )
    }

    /// Get both YES and NO prices
    public fun get_all_prices(pool: &Pool): (u64, u64) {
        let yes_price = get_price(pool, 0);
        let no_price = get_price(pool, 1);
        (yes_price, no_price)
    }

    /// Get constant product (k = x × y)
    public fun get_constant_product(pool: &Pool): u64 {
        safe_mul(pool.reserve_yes, pool.reserve_no)
    }

}
