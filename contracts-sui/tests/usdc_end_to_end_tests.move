// End-to-end USDC flow from bet → resolve → settlement → treasury claim.
#[test_only]
#[allow(duplicate_alias, unused_use)]
module prediction_market::usdc_end_to_end_tests {
    use prediction_market::access_control::RoleRegistry;
    use prediction_market::oracle_validator::OracleRegistry;
    use prediction_market::global_treasury::{Self as treasury, GlobalTreasury, ClaimTicket};
    use prediction_market::market_manager_v2::{
        Self as market_manager,
        Market,
        MarketPoolShard,
        SettlementQueue,
        AdminCap,
        ResolverCap,
        Position,
    };
    use prediction_market::test_harness;
    use circle_usdc::usdc::USDC;
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::clock::{Self as clock, Clock};
    use sui::coin::{Self as coin, Coin};
    use sui::object::{Self as object, ID};

    const ADMIN: address = @0xA;
    const USER: address = @0xB;
    const PYTH: vector<u8> = b"pyth";
    const PRICE: u64 = 1_000_000;
    const SOURCES: u64 = 1;

    #[test]
    fun test_full_bet_resolve_settle_claim() {
        let (admin, mut scenario) = bootstrap_env();
        let _treasury_id = share_treasury(&mut scenario, admin);

        deposit_liquidity(&mut scenario, admin, 2_000_000);
        let market_id = create_market_with_single_shard(&mut scenario, admin, b"Will USDC stay $1?");

        place_bet(&mut scenario, admin, USER, market_id, 1_000_000, 1, 1_200_000);
        resolve_market_yes(&mut scenario, admin, market_id, 100_000_000);

        let _seq = request_settlement(&mut scenario, USER, market_id, 100_200_000);
        execute_settlements(&mut scenario, admin, market_id, 10);

        // User should now hold a claim ticket worth ~1 USDC.
        test_harness::finalize_tx(&mut scenario, USER);
        {
            let ticket = ts::take_from_sender<ClaimTicket>(&scenario);
            let mut treasury_obj = ts::take_shared<GlobalTreasury>(&scenario);
            let payout = treasury::redeem_claim(&mut treasury_obj, ticket, ts::ctx(&mut scenario));
            assert!(coin::value(&payout) == 1_000_000, 0);
            coin::burn_for_testing(payout);
            test_harness::return_shared(treasury_obj);
        };

        ts::end(scenario);
    }

    // --- helpers ---

    fun bootstrap_env(): (address, Scenario) {
        let admin = ADMIN;
        let mut scenario = test_harness::bootstrap(admin);
        test_harness::grant_protocol_roles(&mut scenario, admin, admin);
        test_harness::whitelist_oracle_source(&mut scenario, admin, PYTH);
        test_harness::update_oracle_price(&mut scenario, admin, PYTH, PRICE);
        (admin, scenario)
    }

    fun share_treasury(scenario: &mut Scenario, admin: address): ID {
        test_harness::finalize_tx(scenario, admin);
        let treasury_ref = test_harness::take_treasury(scenario);
        let id = object::id(&treasury_ref);
        test_harness::return_shared(treasury_ref);
        id
    }

    fun deposit_liquidity(
        scenario: &mut Scenario,
        admin: address,
        amount: u64,
    ) {
        test_harness::mint_native_usdc(scenario, admin, admin, amount);
        test_harness::finalize_tx(scenario, admin);
        {
            let mut treasury_obj = test_harness::take_treasury(scenario);
            let deposit = ts::take_from_sender<Coin<USDC>>(scenario);
            treasury::deposit_liquidity(&mut treasury_obj, deposit);
            test_harness::return_shared(treasury_obj);
        };
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
        let mut shard = test_harness::take_shared_pool(scenario);
        let clk = test_harness::make_clock(scenario, timestamp_ms);
        let payment = ts::take_from_sender<Coin<USDC>>(scenario);

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

    fun execute_settlements(
        scenario: &mut Scenario,
        admin: address,
        market_id: ID,
        max_to_process: u64,
    ) {
        test_harness::finalize_tx(scenario, admin);
        {
            let market = ts::take_shared_by_id<Market>(scenario, market_id);
            let mut queue = ts::take_shared<SettlementQueue>(scenario);
            let mut treasury_obj = test_harness::take_treasury(scenario);
            let admin_cap = ts::take_from_sender<AdminCap>(scenario);

            market_manager::execute_settlements(
                &admin_cap,
                &market,
                &mut queue,
                &mut treasury_obj,
                max_to_process,
                ts::ctx(scenario),
            );

            test_harness::return_shared(market);
            test_harness::return_shared(queue);
            test_harness::return_shared(treasury_obj);
            ts::return_to_sender(scenario, admin_cap);
        };
    }
}

