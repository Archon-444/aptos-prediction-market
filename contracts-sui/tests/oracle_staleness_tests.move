// Oracle Staleness and Manipulation Tests
// Protects against flash loan attacks and stale price exploitation
//
// CRITICAL: Oracle manipulation is a top DeFi attack vector
// These tests MUST pass before mainnet deployment

#[test_only]
#[allow(duplicate_alias, unused_use)]
module prediction_market::oracle_staleness_tests {
    use prediction_market::oracle_validator::{
        Self as oracle_validator,
        OracleRegistry,
        OracleAdminCap,
        OraclePrice,
        AggregatedPrice,
    };
    use prediction_market::test_harness;
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::clock::{Self as clock, Clock};
    use std::string;
    use std::vector;

    const ADMIN: address = @0xAD;
    const PYTH: vector<u8> = b"pyth";
    const CHAINLINK: vector<u8> = b"chainlink";
    const BINANCE: vector<u8> = b"binance";

    #[test]
    /// Test: Fresh prices are accepted
    fun test_accepts_fresh_price() {
        let (admin, mut scenario) = bootstrap_env(ADMIN);

        test_harness::finalize_tx(&mut scenario, admin);
        {
            let registry = ts::take_shared<OracleRegistry>(&scenario);
            let clock = test_harness::make_clock(&mut scenario, 10000);

            let price_data = oracle_validator::create_test_price(
                50000,
                8000,
                PYTH
            );

            let verified_price = oracle_validator::verify_price(
                &registry,
                &price_data,
                &clock
            );

            assert!(verified_price == 50000, 0);

            clock::destroy_for_testing(clock);
            test_harness::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_validator::E_STALE_PRICE)]
    /// Test: Stale prices are rejected (>5s old)
    fun test_rejects_stale_price() {
        let (admin, mut scenario) = bootstrap_env(ADMIN);

        test_harness::finalize_tx(&mut scenario, admin);
        {
            let registry = ts::take_shared<OracleRegistry>(&scenario);
            let clock = test_harness::make_clock(&mut scenario, 20000);

            let stale_price = oracle_validator::create_test_price(
                50000,
                10000,
                PYTH
            );

            let _verified = oracle_validator::verify_price(
                &registry,
                &stale_price,
                &clock
            );

            clock::destroy_for_testing(clock);
            test_harness::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_validator::E_PRICE_DEVIATION_TOO_HIGH)]
    /// Test: Extreme price movements trigger circuit breaker
    fun test_price_deviation_circuit_breaker() {
        let (admin, mut scenario) = bootstrap_env(ADMIN);

        test_harness::update_oracle_price(&mut scenario, admin, PYTH, 50000);

        test_harness::finalize_tx(&mut scenario, admin);
        {
            let registry = ts::take_shared<OracleRegistry>(&scenario);
            let clock = test_harness::make_clock(&mut scenario, 10000);

            let manipulated_price = oracle_validator::create_test_price(
                60000,
                9000,
                PYTH
            );

            let _verified = oracle_validator::verify_price(
                &registry,
                &manipulated_price,
                &clock
            );

            clock::destroy_for_testing(clock);
            test_harness::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    /// Test: Acceptable price movements are allowed
    fun test_acceptable_price_movement() {
        let (admin, mut scenario) = bootstrap_env(ADMIN);

        test_harness::update_oracle_price(&mut scenario, admin, PYTH, 50000);

        test_harness::finalize_tx(&mut scenario, admin);
        {
            let registry = ts::take_shared<OracleRegistry>(&scenario);
            let clock = test_harness::make_clock(&mut scenario, 10000);

            let acceptable_price = oracle_validator::create_test_price(
                52500,
                9500,
                PYTH
            );

            let verified = oracle_validator::verify_price(
                &registry,
                &acceptable_price,
                &clock
            );

            assert!(verified == 52500, 0);

            clock::destroy_for_testing(clock);
            test_harness::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    /// Test: Multi-oracle aggregation (median calculation)
    fun test_multi_oracle_aggregation() {
        let (admin, mut scenario) = bootstrap_env(ADMIN);

        test_harness::whitelist_oracle_source(&mut scenario, admin, CHAINLINK);
        test_harness::whitelist_oracle_source(&mut scenario, admin, BINANCE);

        test_harness::finalize_tx(&mut scenario, admin);
        {
            let registry = ts::take_shared<OracleRegistry>(&scenario);
            let clock = test_harness::make_clock(&mut scenario, 10000);

            let mut prices = vector::empty<OraclePrice>();

            vector::push_back(&mut prices, oracle_validator::create_test_price(
                50000,
                9500,
                PYTH
            ));

            vector::push_back(&mut prices, oracle_validator::create_test_price(
                50100,
                9600,
                CHAINLINK
            ));

            vector::push_back(&mut prices, oracle_validator::create_test_price(
                49900,
                9700,
                BINANCE
            ));

            let aggregated = oracle_validator::aggregate_prices(
                &registry,
                prices,
                &clock
            );

            let median = oracle_validator::get_aggregated_median(&aggregated);
            let num_sources = oracle_validator::get_aggregated_num_sources(&aggregated);
            let verified = oracle_validator::get_aggregated_verified(&aggregated);

            assert!(median == 50000, 0);
            assert!(num_sources == 3, 1);
            assert!(verified, 2);

            clock::destroy_for_testing(clock);
            test_harness::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    /// Test: Median is resistant to outliers
    fun test_median_resistant_to_outliers() {
        let (admin, mut scenario) = bootstrap_env(ADMIN);

        test_harness::whitelist_oracle_source(&mut scenario, admin, CHAINLINK);
        test_harness::whitelist_oracle_source(&mut scenario, admin, BINANCE);

        test_harness::update_oracle_price(&mut scenario, admin, PYTH, 50000);
        test_harness::update_oracle_price(&mut scenario, admin, CHAINLINK, 50000);
        test_harness::update_oracle_price(&mut scenario, admin, BINANCE, 50000);

        test_harness::finalize_tx(&mut scenario, admin);
        {
            let registry = ts::take_shared<OracleRegistry>(&scenario);
            let clock = test_harness::make_clock(&mut scenario, 10000);

            let mut prices = vector::empty<OraclePrice>();

            vector::push_back(&mut prices, oracle_validator::create_test_price(
                50000,
                9500,
                PYTH
            ));

            vector::push_back(&mut prices, oracle_validator::create_test_price(
                50100,
                9600,
                CHAINLINK
            ));

            vector::push_back(&mut prices, oracle_validator::create_test_price(
                51000,
                9700,
                BINANCE
            ));

            let aggregated = oracle_validator::aggregate_prices(
                &registry,
                prices,
                &clock
            );

            let median = oracle_validator::get_aggregated_median(&aggregated);

            assert!(median == 50100, 0);

            clock::destroy_for_testing(clock);
            test_harness::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    /// Test: Single oracle snapshot is accepted when policy minimum is one
    fun test_single_oracle_aggregate() {
        let (admin, mut scenario) = bootstrap_env(ADMIN);

        test_harness::finalize_tx(&mut scenario, admin);
        {
            let registry = ts::take_shared<OracleRegistry>(&scenario);
            let clock = test_harness::make_clock(&mut scenario, 10000);

            let mut prices = vector::empty<OraclePrice>();
            vector::push_back(&mut prices, oracle_validator::create_test_price(
                50000,
                9500,
                PYTH
            ));

            let aggregated = oracle_validator::aggregate_prices(
                &registry,
                prices,
                &clock
            );

            assert!(oracle_validator::get_aggregated_num_sources(&aggregated) == 1, 0);
            assert!(oracle_validator::get_aggregated_median(&aggregated) == 50000, 1);

            clock::destroy_for_testing(clock);
            test_harness::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_validator::E_ORACLE_NOT_WHITELISTED)]
    /// Test: Non-whitelisted oracles are rejected
    fun test_rejects_non_whitelisted_oracle() {
        let (admin, mut scenario) = bootstrap_env(ADMIN);

        test_harness::finalize_tx(&mut scenario, admin);
        {
            let registry = ts::take_shared<OracleRegistry>(&scenario);
            let clock = test_harness::make_clock(&mut scenario, 10000);

            let price_data = oracle_validator::create_test_price(
                50000,
                9500,
                CHAINLINK
            );

            let _verified = oracle_validator::verify_price(
                &registry,
                &price_data,
                &clock
            );

            clock::destroy_for_testing(clock);
            test_harness::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    /// Test: Circuit breaker prevents all oracle operations
    fun test_circuit_breaker_activation() {
        let (admin, mut scenario) = bootstrap_env(ADMIN);

        test_harness::finalize_tx(&mut scenario, admin);
        {
            let admin_cap = ts::take_from_sender<OracleAdminCap>(&scenario);
            let mut registry = ts::take_shared<OracleRegistry>(&scenario);
            let clock = test_harness::make_clock(&mut scenario, 10000);

            oracle_validator::activate_circuit_breaker(
                &admin_cap,
                &mut registry,
                b"Emergency: oracle manipulation detected",
                &clock
            );

            assert!(oracle_validator::is_circuit_breaker_active(&registry), 0);

            clock::destroy_for_testing(clock);
            test_harness::return_shared(registry);
            ts::return_to_sender(&scenario, admin_cap);
        };

        ts::end(scenario);
    }

    #[test]
    /// Test: Price validation helper function
    fun test_is_price_valid_helper() {
        let (admin, mut scenario) = bootstrap_env(ADMIN);

        test_harness::finalize_tx(&mut scenario, admin);
        {
            let registry = ts::take_shared<OracleRegistry>(&scenario);

            assert!(oracle_validator::is_price_valid(&registry, 50000, 52000), 0);
            assert!(oracle_validator::is_price_valid(&registry, 50000, 48000), 1);
            assert!(!oracle_validator::is_price_valid(&registry, 50000, 60000), 2);
            assert!(!oracle_validator::is_price_valid(&registry, 50000, 40000), 3);
            assert!(!oracle_validator::is_price_valid(&registry, 50000, 0), 4);
            assert!(!oracle_validator::is_price_valid(&registry, 50000, 2_000_000_000_000), 5);

            test_harness::return_shared(registry);
        };

        ts::end(scenario);
    }

    fun bootstrap_env(admin: address): (address, Scenario) {
        let mut scenario = test_harness::bootstrap(admin);
        test_harness::whitelist_oracle_source(&mut scenario, admin, PYTH);
        (admin, scenario)
    }
}
