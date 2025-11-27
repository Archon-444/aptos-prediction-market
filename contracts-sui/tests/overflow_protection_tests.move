// Overflow protection exercises against hardened market manager.
#[test_only]
#[allow(duplicate_alias, unused_use)]
module prediction_market::overflow_protection_tests {
    use prediction_market::access_control::RoleRegistry;
    use prediction_market::test_harness;
    use prediction_market::market_manager_v2::{
        Self as market_manager,
        Market,
        MarketPoolShard,
    };
    use circle_usdc::usdc::USDC;
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::clock::{Self as clock, Clock};
    use sui::coin::{Self as coin, Coin};
    use sui::object::{Self as object, ID};

    const ADMIN: address = @0xAD;
    const ADMIN_ALT: address = @0xAE;
    const USER: address = @0xC1;
    const MAX_U64: u64 = 18446744073709551615;

    #[test]
    fun test_max_value_safe_multiplication() {
        let result = market_manager::test_safe_multiply((MAX_U64 - 1_000_000) / 1_000_000, 1_000);
        assert!(result > 0, 0);
        assert!(result < MAX_U64, 1);
    }

    #[test]
    fun test_share_calculation_extreme_ratios() {
        let (admin, mut scenario) = bootstrap_env(ADMIN);
        let market_id = create_market_with_single_shard(&mut scenario, admin, b"Extreme ratios?");

        place_bet(&mut scenario, admin, USER, market_id, 1_000_000_000_000, 1, 1_200_000);
        place_bet(&mut scenario, admin, USER, market_id, 1_000_000, 0, 1_250_000);

        ts::end(scenario);
    }

    #[test]
    fun test_initial_pool_state() {
        let (admin, mut scenario) = bootstrap_env(ADMIN_ALT);
        let _market_id = create_market_with_single_shard(&mut scenario, admin, b"Division guard?");

        test_harness::finalize_tx(&mut scenario, admin);
        {
            let pool = test_harness::take_shared_pool(&scenario);
            let (_, yes_bal, no_bal, _, _) = market_manager::get_pool_info(&pool);
            assert!(yes_bal == 0, 0);
            assert!(no_bal == 0, 1);
            test_harness::return_shared(pool);
        };

        ts::end(scenario);
    }

    // --- helpers ---

    fun bootstrap_env(admin: address): (address, Scenario) {
        let mut scenario = test_harness::bootstrap(admin);
        test_harness::grant_protocol_roles(&mut scenario, admin, admin);
        (admin, scenario)
    }

    fun create_market_with_single_shard(
        scenario: &mut Scenario,
        admin: address,
        question: vector<u8>,
    ): ID {
        test_harness::finalize_tx(scenario, admin);
        {
            let registry = ts::take_shared<RoleRegistry>(scenario);
            test_harness::create_market_default(
                scenario,
                question,
                vector[b"Yes", b"No"],
                24,
                b"Manual",
                1,
                1_000_000,
                &registry,
            );
            test_harness::return_shared(registry);
        };

        test_harness::finalize_tx(scenario, admin);
        let market = test_harness::take_shared_market(scenario);
        let market_id = object::id(&market);
        market_manager::create_pool_shard(&market, 0, ts::ctx(scenario));
        test_harness::return_shared(market);
        market_id
    }

    fun place_bet(
        scenario: &mut Scenario,
        admin: address,
        user: address,
        market_id: ID,
        amount: u64,
        outcome: u8,
        timestamp_ms: u64,
    ) {
        test_harness::mint_native_usdc(scenario, admin, user, amount);
        test_harness::finalize_tx(scenario, user);
        let market = ts::take_shared_by_id<Market>(scenario, market_id);
        let mut pool = test_harness::take_shared_pool(scenario);
        let clk = test_harness::make_clock(scenario, timestamp_ms);
        let payment = ts::take_from_sender<Coin<USDC>>(scenario);

        market_manager::place_bet(
            &market,
            &mut pool,
            payment,
            outcome,
            &clk,
            ts::ctx(scenario),
        );

        clock::destroy_for_testing(clk);
        test_harness::return_shared(market);
        test_harness::return_shared(pool);
    }
}

