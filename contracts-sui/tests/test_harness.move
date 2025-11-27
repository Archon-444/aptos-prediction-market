#[test_only]
#[allow(duplicate_alias, unused_use)]
module prediction_market::test_harness {
    use sui::test_scenario::{Self as ts, Scenario, TransactionEffects};
    use sui::clock::{Self as clock, Clock};
    use sui::coin::{Self as coin, Coin};
    use sui::transfer;
    use std::vector;

    use prediction_market::access_control::{
        Self as access_control,
        AdminCap as AccessAdminCap,
        RoleRegistry,
    };
    use prediction_market::oracle_validator::{
        Self as oracle_validator,
        OracleAdminCap,
        OracleRegistry,
    };
    use prediction_market::global_treasury::{
        Self as global_treasury,
        GlobalTreasury,
    };
    use prediction_market::market_manager_v2;

    use circle_usdc::usdc::USDC;

    const DEFAULT_SHARDS: u8 = 16;
    const DEFAULT_DURATION_HOURS: u64 = 24;
    const DEFAULT_RESOLUTION: vector<u8> = b"automation";
    const ROLE_MARKET_CREATOR: u8 = 1;
    const ROLE_RESOLVER: u8 = 2;
    const ROLE_ORACLE_MANAGER: u8 = 3;

    /// Bootstrap a fresh prediction-market environment for Sui tests.
    /// Initializes access control, oracle registry, market manager, and treasury shared objects.
    public fun bootstrap(admin: address): Scenario {
        let mut scenario = ts::begin(admin);
        {
            access_control::init_for_testing(ts::ctx(&mut scenario));
            oracle_validator::init_for_testing(ts::ctx(&mut scenario));
            market_manager_v2::init_for_testing(ts::ctx(&mut scenario));

            let treasury = global_treasury::init_for_testing(ts::ctx(&mut scenario));
            global_treasury::share_for_testing(treasury);
        };
        // flush transaction so shared objects become available
        finalize_tx(&mut scenario, admin);
        scenario
    }

    /// Advance to the next transaction, discarding the effects.
    public fun finalize_tx(scenario: &mut Scenario, sender: address) {
        let _effects: TransactionEffects = ts::next_tx(scenario, sender);
    }

    /// Grant creation, resolution, and oracle management privileges to `wallet`.
    public fun grant_protocol_roles(
        scenario: &mut Scenario,
        admin: address,
        wallet: address,
    ) {
        finalize_tx(scenario, admin);
        {
            let admin_cap = ts::take_from_sender<AccessAdminCap>(scenario);
            let mut registry = ts::take_shared<RoleRegistry>(scenario);
            access_control::grant_role(&admin_cap, &mut registry, wallet, ROLE_MARKET_CREATOR, ts::ctx(scenario));
            access_control::grant_role(&admin_cap, &mut registry, wallet, ROLE_RESOLVER, ts::ctx(scenario));
            access_control::grant_role(&admin_cap, &mut registry, wallet, ROLE_ORACLE_MANAGER, ts::ctx(scenario));
            ts::return_shared(registry);
            ts::return_to_sender(scenario, admin_cap);
        };
    }

    /// Whitelist an oracle source string (e.g. b"pyth") for the registry.
    public fun whitelist_oracle_source(
        scenario: &mut Scenario,
        admin: address,
        source: vector<u8>,
    ) {
        finalize_tx(scenario, admin);
        {
            let admin_cap = ts::take_from_sender<OracleAdminCap>(scenario);
            let mut registry = ts::take_shared<OracleRegistry>(scenario);
            oracle_validator::whitelist_source(&admin_cap, &mut registry, source);
            ts::return_shared(registry);
            ts::return_to_sender(scenario, admin_cap);
        };
    }

    /// Update the last known price for a whitelisted oracle source.
    public fun update_oracle_price(
        scenario: &mut Scenario,
        admin: address,
        source: vector<u8>,
        price: u64,
    ) {
        finalize_tx(scenario, admin);
        {
            let admin_cap = ts::take_from_sender<OracleAdminCap>(scenario);
            let mut registry = ts::take_shared<OracleRegistry>(scenario);
            oracle_validator::update_last_price(&admin_cap, &mut registry, source, price);
            ts::return_shared(registry);
            ts::return_to_sender(scenario, admin_cap);
        };
    }

    /// Mint native USDC and transfer it to `recipient`.
    /// Uses the admin account as the mint authority for the test scenario.
    public fun mint_native_usdc(
        scenario: &mut Scenario,
        admin: address,
        recipient: address,
        amount: u64,
    ) {
        finalize_tx(scenario, admin);
        {
            let coin = coin::mint_for_testing<USDC>(amount, ts::ctx(scenario));
            transfer::public_transfer(coin, recipient);
        };
    }

    /// Helper to create a testing clock with the provided timestamp (in ms).
    /// Caller is responsible for destroying the clock after use.
    public fun make_clock(scenario: &mut Scenario, timestamp_ms: u64): Clock {
        let mut clk = clock::create_for_testing(ts::ctx(scenario));
        if (timestamp_ms != 0) {
            clock::set_for_testing(&mut clk, timestamp_ms);
        };
        clk
    }

    /// Create a market using the hardened market manager.
    /// Assumes the caller already set the transaction sender via `finalize_tx`.
    public fun create_market_default(
        scenario: &mut Scenario,
        question: vector<u8>,
        outcomes: vector<vector<u8>>,
        duration_hours: u64,
        resolution_source: vector<u8>,
        num_shards: u8,
        clock_timestamp_ms: u64,
        registry: &RoleRegistry,
    ) {
        let duration = if (duration_hours == 0) {
            DEFAULT_DURATION_HOURS
        } else {
            duration_hours
        };
        let resolution = if (vector::length(&resolution_source) == 0) {
            DEFAULT_RESOLUTION
        } else {
            resolution_source
        };
        let shards = if (num_shards == 0) {
            DEFAULT_SHARDS
        } else {
            num_shards
        };

        let clk = make_clock(scenario, clock_timestamp_ms);

        market_manager_v2::create_market(
            question,
            outcomes,
            duration,
            resolution,
            shards,
            registry,
            &clk,
            ts::ctx(scenario),
        );

        clock::destroy_for_testing(clk);
    }

    /// Convenience function to retrieve the most recently created shared Market.
    public fun take_shared_market(scenario: &Scenario): market_manager_v2::Market {
        ts::take_shared<market_manager_v2::Market>(scenario)
    }

    /// Convenience function to retrieve the most recent shared settlement queue.
    public fun take_shared_queue(
        scenario: &Scenario,
    ): market_manager_v2::SettlementQueue {
        ts::take_shared<market_manager_v2::SettlementQueue>(scenario)
    }

    /// Convenience function to retrieve the most recent shared market pool shard.
    public fun take_shared_pool(
        scenario: &Scenario,
    ): market_manager_v2::MarketPoolShard {
        ts::take_shared<market_manager_v2::MarketPoolShard>(scenario)
    }

    /// Convenience function to retrieve the global treasury shared object.
    public fun take_treasury(scenario: &Scenario): GlobalTreasury {
        ts::take_shared<GlobalTreasury>(scenario)
    }

    /// Return shared objects borrowed through helper methods.
    public fun return_shared<T: key>(obj: T) {
        ts::return_shared(obj);
    }
}

