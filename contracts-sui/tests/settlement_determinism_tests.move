// Settlement determinism suite using hardened Sui fixtures.
#[test_only]
#[allow(duplicate_alias, unused_use)]
module prediction_market::settlement_determinism_tests {
    use prediction_market::access_control::RoleRegistry;
    use prediction_market::oracle_validator::OracleRegistry;
    use prediction_market::test_harness;
    use prediction_market::market_manager_v2::{
        Self as market_manager,
        Market,
        MarketPoolShard,
        SettlementQueue,
        Position,
        ResolverCap,
    };
    use circle_usdc::usdc::USDC;
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::clock::{Self as clock, Clock};
    use sui::coin;
    use sui::object::{Self as object, ID};

    const ADMIN: address = @0xAD;
    const ADMIN_ALT: address = @0xAE;
    const USER_A: address = @0xA;
    const USER_B: address = @0xB;
    const USER_C: address = @0xC;

    const PYTH: vector<u8> = b"pyth";
    const RESOLUTION_SOURCE: vector<u8> = b"Manual";
    const PRICE: u64 = 1_000_000;
    const SOURCES: u64 = 1;

    #[test]
    fun test_deterministic_settlement_ordering() {
        let (admin1, mut scenario1) = bootstrap_env(ADMIN);
        let market_id_1 = create_market_with_single_shard(&mut scenario1, admin1, b"Deterministic?");

        place_bet(&mut scenario1, USER_A, market_id_1, 1_000_000, 1, 1_200_000);
        place_bet(&mut scenario1, USER_B, market_id_1, 1_000_000, 1, 1_300_000);

        resolve_market_yes(&mut scenario1, admin1, market_id_1, 100_000_000);

        let seq_a_1 = request_settlement(&mut scenario1, USER_A, market_id_1, 100_200_000);
        let seq_b_1 = request_settlement(&mut scenario1, USER_B, market_id_1, 100_300_000);

        assert!(seq_a_1 == 0, 0);
        assert!(seq_b_1 == 1, 1);

        ts::end(scenario1);

        let (admin2, mut scenario2) = bootstrap_env(ADMIN_ALT);
        let market_id_2 = create_market_with_single_shard(&mut scenario2, admin2, b"Deterministic?");

        place_bet(&mut scenario2, USER_A, market_id_2, 1_000_000, 1, 1_200_000);
        place_bet(&mut scenario2, USER_B, market_id_2, 1_000_000, 1, 1_300_000);

        resolve_market_yes(&mut scenario2, admin2, market_id_2, 100_000_000);

        let seq_b_2 = request_settlement(&mut scenario2, USER_B, market_id_2, 100_200_000);
        let seq_a_2 = request_settlement(&mut scenario2, USER_A, market_id_2, 100_300_000);

        assert!(seq_b_2 == 0, 2);
        assert!(seq_a_2 == 1, 3);

        ts::end(scenario2);
    }

    #[test]
    fun test_queue_orders_settlements() {
        let (admin, mut scenario) = bootstrap_env(ADMIN);
        let market_id = create_market_with_single_shard(&mut scenario, admin, b"Queue Ordering?");

        place_bet(&mut scenario, USER_A, market_id, 1_000_000, 1, 1_200_000);
        place_bet(&mut scenario, USER_B, market_id, 2_000_000, 1, 1_250_000);
        place_bet(&mut scenario, USER_C, market_id, 1_500_000, 1, 1_260_000);

        resolve_market_yes(&mut scenario, admin, market_id, 100_000_000);

        let _seq_a = request_settlement(&mut scenario, USER_A, market_id, 100_200_000);
        let _seq_b = request_settlement(&mut scenario, USER_B, market_id, 100_250_000);

        test_harness::finalize_tx(&mut scenario, admin);
        {
            let queue = ts::take_shared<SettlementQueue>(&scenario);
            let (next_sequence, processed_count, pending_len) = market_manager::get_settlement_queue_info(&queue);
            assert!(next_sequence == 2, 4);
            assert!(processed_count == 0, 5);
            assert!(pending_len == 2, 6);
            test_harness::return_shared(queue);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_late_settlement_request() {
        let (admin, mut scenario) = bootstrap_env(ADMIN);
        let market_id = create_market_with_single_shard(&mut scenario, admin, b"Late Request?");

        place_bet(&mut scenario, USER_A, market_id, 1_000_000, 1, 1_200_000);
        place_bet(&mut scenario, USER_B, market_id, 1_000_000, 1, 1_220_000);
        place_bet(&mut scenario, USER_C, market_id, 1_000_000, 1, 1_400_000);

        resolve_market_yes(&mut scenario, admin, market_id, 100_000_000);

        let seq_a = request_settlement(&mut scenario, USER_A, market_id, 100_150_000);
        let seq_b = request_settlement(&mut scenario, USER_B, market_id, 100_180_000);
        let seq_c = request_settlement(&mut scenario, USER_C, market_id, 100_300_000);

        assert!(seq_a == 0, 7);
        assert!(seq_b == 1, 8);
        assert!(seq_c == 2, 9);

        ts::end(scenario);
    }

    // --- helpers ---

    fun bootstrap_env(admin: address): (address, Scenario) {
        let mut scenario = test_harness::bootstrap(admin);
        test_harness::grant_protocol_roles(&mut scenario, admin, admin);
        test_harness::whitelist_oracle_source(&mut scenario, admin, PYTH);
        test_harness::update_oracle_price(&mut scenario, admin, PYTH, PRICE);
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
                RESOLUTION_SOURCE,
                1,
                1_000_000,
                &registry,
            );
            test_harness::return_shared(registry);
        };

        test_harness::finalize_tx(scenario, admin);
        let market = ts::take_shared<Market>(scenario);
        let market_id = object::id(&market);
        test_harness::return_shared(market);

        test_harness::finalize_tx(scenario, admin);
        let market_for_shard = ts::take_shared_by_id<Market>(scenario, market_id);
        market_manager::create_pool_shard(&market_for_shard, 0, ts::ctx(scenario));
        test_harness::return_shared(market_for_shard);
        market_id
    }

    fun place_bet(
        scenario: &mut Scenario,
        user: address,
        market_id: ID,
        amount: u64,
        outcome: u8,
        timestamp_ms: u64,
    ) {
        test_harness::finalize_tx(scenario, user);
        let market = ts::take_shared_by_id<Market>(scenario, market_id);
        let mut shard = ts::take_shared<MarketPoolShard>(scenario);
        let clk = test_harness::make_clock(scenario, timestamp_ms);
        let payment = coin::mint_for_testing<USDC>(amount, ts::ctx(scenario));

        market_manager::place_bet(
            &market,
            &mut shard,
            payment,
            outcome,
            &clk,
            ts::ctx(scenario),
        );

        clock::destroy_for_testing(clk);
        test_harness::return_shared(market);
        test_harness::return_shared(shard);

        test_harness::finalize_tx(scenario, user);
        let position = ts::take_from_sender<Position>(scenario);
        ts::return_to_sender(scenario, position);
    }

    fun resolve_market_yes(
        scenario: &mut Scenario,
        admin: address,
        market_id: ID,
        timestamp_ms: u64,
    ) {
        test_harness::finalize_tx(scenario, admin);
        let resolver_cap = ts::take_from_sender<ResolverCap>(scenario);
        let mut market = ts::take_shared_by_id<Market>(scenario, market_id);
        let clk = test_harness::make_clock(scenario, timestamp_ms);
        let registry = ts::take_shared<RoleRegistry>(scenario);
        let oracle_registry = ts::take_shared<OracleRegistry>(scenario);

        market_manager::resolve_market(
            &resolver_cap,
            &mut market,
            1,
            &registry,
            &oracle_registry,
            PRICE,
            SOURCES,
            timestamp_ms,
            true,
            &clk,
            ts::ctx(scenario),
        );

        clock::destroy_for_testing(clk);
        test_harness::return_shared(market);
        test_harness::return_shared(registry);
        test_harness::return_shared(oracle_registry);
        ts::return_to_sender(scenario, resolver_cap);
    }

    fun request_settlement(
        scenario: &mut Scenario,
        user: address,
        market_id: ID,
        timestamp_ms: u64,
    ): u64 {
        test_harness::finalize_tx(scenario, user);
        let market = ts::take_shared_by_id<Market>(scenario, market_id);
        let mut queue = ts::take_shared<SettlementQueue>(scenario);
        let clk = test_harness::make_clock(scenario, timestamp_ms);
        let position = ts::take_from_sender<Position>(scenario);

        market_manager::request_settlement(
            &market,
            position,
            &mut queue,
            &clk,
            ts::ctx(scenario),
        );

        let seq = market_manager::get_next_sequence(&queue) - 1;

        clock::destroy_for_testing(clk);
        test_harness::return_shared(market);
        test_harness::return_shared(queue);
        seq
    }
}

