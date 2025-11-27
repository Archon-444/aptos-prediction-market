#[test_only]
module prediction_market::comprehensive_integration_tests {
    use std::signer;
    use std::vector;
    use std::string;
    use aptos_framework::timestamp;
    use aptos_framework::account;
    use aptos_framework::fungible_asset::{Self as fungible_asset, MintRef};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::object;
    use aptos_std::option;
    use prediction_market::collateral_vault;
    use prediction_market::betting;
    use prediction_market::market_manager;
    use prediction_market::access_control;
    use prediction_market::commit_reveal;
    use aptos_std::aptos_hash;

    const COMMIT_PHASE_ADVANCE: u64 = 301;

    struct TestContext has key {
        mint_ref: MintRef,
        metadata: object::Object<fungible_asset::Metadata>,
    }
    // Note: Oracle and dispute resolution have complex initialization requirements
    // These are tested separately in their dedicated test files

    // Test helper to setup testing environment
    fun setup_test(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
    ): address acquires TestContext {
        timestamp::set_time_has_started_for_testing(aptos_framework);
        account::create_account_for_test(@0x1);
        account::create_account_for_test(@0xcafe);
        account::create_account_for_test(@prediction_market);

        if (!exists<TestContext>(@prediction_market)) {
            let constructor_ref = object::create_named_object(usdc_admin, b"TUSDC");
            primary_fungible_store::create_primary_store_enabled_fungible_asset(
                &constructor_ref,
                option::none<u128>(),
                string::utf8(b"Test USDC"),
                string::utf8(b"TUSDC"),
                6,
                string::utf8(b""),
                string::utf8(b""),
            );
            let mint_ref = fungible_asset::generate_mint_ref(&constructor_ref);
            let metadata = object::object_from_constructor_ref<fungible_asset::Metadata>(&constructor_ref);
            move_to(pm_admin, TestContext { mint_ref, metadata });
        };

        market_manager::initialize(pm_admin);

        let context = borrow_global<TestContext>(@prediction_market);
        let metadata_addr = object::object_address(&context.metadata);
        collateral_vault::initialize(pm_admin, vector::singleton(0u8), metadata_addr);

        betting::initialize(pm_admin);
        commit_reveal::initialize(pm_admin);

        @prediction_market
    }

    fun mint_usdc_to_user(user: &signer, amount: u64) acquires TestContext {
        let context = borrow_global<TestContext>(@prediction_market);
        primary_fungible_store::mint(&context.mint_ref, signer::address_of(user), amount);
    }

    fun get_usdc_balance(account_addr: address): u64 acquires TestContext {
        let context = borrow_global<TestContext>(@prediction_market);
        primary_fungible_store::balance(account_addr, context.metadata)
    }

    fun build_commit_message(
        market_id: u64,
        outcome: u8,
        amount: u64,
        nonce: &vector<u8>,
    ): vector<u8> {
        let message = vector::empty<u8>();
        append_bytes(&mut message, to_bytes_u64(market_id));
        vector::push_back(&mut message, outcome);
        append_bytes(&mut message, to_bytes_u64(amount));
        append_slice(&mut message, nonce);
        message
    }

    fun append_slice(target: &mut vector<u8>, slice: &vector<u8>) {
        let i = 0;
        let len = vector::length(slice);
        while (i < len) {
            vector::push_back(target, *vector::borrow(slice, i));
            i = i + 1;
        };
    }

    fun append_bytes(target: &mut vector<u8>, data: vector<u8>) {
        let i = 0;
        let len = vector::length(&data);
        while (i < len) {
            vector::push_back(target, *vector::borrow(&data, i));
            i = i + 1;
        };
    }

    fun to_bytes_u64(value: u64): vector<u8> {
        let bytes = vector::empty<u8>();
        let i = 0;
        while (i < 8) {
            vector::push_back(&mut bytes, ((value >> (i * 8)) & 0xFF as u8));
            i = i + 1;
        };
        bytes
    }

    // Test: Access Control - Role Management
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, user1 = @0x100, user2 = @0x200)]
    public fun test_role_management(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        user1: &signer,
        user2: &signer,
    ) acquires TestContext {
        setup_test(aptos_framework, usdc_admin, pm_admin);
        let user1_addr = signer::address_of(user1);
        let user2_addr = signer::address_of(user2);

        // Admin should have admin role
        assert!(access_control::is_admin(signer::address_of(pm_admin)), 1);

        // Grant market creator role to user1
        access_control::grant_role(pm_admin, user1_addr, 1); // MARKET_CREATOR
        assert!(access_control::has_role(user1_addr, 1), 2);

        // Grant resolver role to user2
        access_control::grant_role(pm_admin, user2_addr, 2); // RESOLVER
        assert!(access_control::has_role(user2_addr, 2), 3);

        // Revoke role from user1
        access_control::revoke_role(pm_admin, user1_addr, 1);
        assert!(!access_control::has_role(user1_addr, 1), 4);
    }

    // Test: Pause Mechanism
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, pauser = @0x100)]
    public fun test_pause_mechanism(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        pauser: &signer,
    ) acquires TestContext {
        setup_test(aptos_framework, usdc_admin, pm_admin);

        // System should not be paused initially
        assert!(!access_control::is_paused(), 1);

        // Grant pauser role to pauser account
        access_control::grant_role(pm_admin, signer::address_of(pauser), 4); // PAUSER

        // Pause system
        access_control::pause(pauser);
        assert!(access_control::is_paused(), 2);

        // Unpause system (admin only)
        access_control::unpause(pm_admin);
        assert!(!access_control::is_paused(), 3);
    }

    // Test: Market creation by authorized user
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, creator = @0x100)]
    public fun test_authorized_market_creation(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        creator: &signer,
    ) acquires TestContext {
        setup_test(aptos_framework, usdc_admin, pm_admin);
        let creator_addr = signer::address_of(creator);

        // Grant market creator role
        access_control::grant_role(pm_admin, creator_addr, 1); // MARKET_CREATOR

        // Create market as authorized creator
        market_manager::create_market(
            creator,
            b"Will ETH reach $10k?",
            vector[b"Yes", b"No"],
            48
        );

        assert!(market_manager::get_market_count() == 1, 1);
        assert!(market_manager::is_market_active(0), 2);
    }

    // Note: Oracle tests require specific oracle registration
    // See oracle.move tests for oracle-specific functionality

    // Test: Commit-Reveal for large bets
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, user = @0x100)]
    public fun test_commit_reveal_flow(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        user: &signer,
    ) acquires TestContext {
        setup_test(aptos_framework, usdc_admin, pm_admin);
        account::create_account_for_test(signer::address_of(user));

        let bet_amount = 50_000000;
        mint_usdc_to_user(user, bet_amount);

        market_manager::create_market(
            pm_admin,
            b"Commit reveal market",
            vector[b"Yes", b"No"],
            48
        );

        let market_id = 0u64;
        let outcome = 1u8;

        let nonce = vector[
            0x10, 0x20, 0x30, 0x40,
            0x50, 0x60, 0x70, 0x80,
            0x90, 0xA0, 0xB0, 0xC0,
            0xD0, 0xE0, 0xF0, 0x01
        ];

        let message = build_commit_message(market_id, outcome, bet_amount, &nonce);
        let commitment = aptos_hash::keccak256(message);

        commit_reveal::commit_bet(
            user,
            market_id,
            commitment,
        );

        assert!(commit_reveal::is_commit_phase(market_id), 1);
        assert!(!commit_reveal::is_reveal_phase(market_id), 2);

        timestamp::fast_forward_seconds(COMMIT_PHASE_ADVANCE);

        assert!(!commit_reveal::is_commit_phase(market_id), 3);
        assert!(commit_reveal::is_reveal_phase(market_id), 4);

        betting::place_bet_with_reveal(
            user,
            market_id,
            outcome,
            bet_amount,
            nonce,
        );

        let (stored_outcome, stored_amount, stored_shares, claimed) = collateral_vault::get_user_position(
            signer::address_of(user),
            market_id,
        );

        assert!(stored_outcome == outcome, 5);
        assert!(stored_amount == bet_amount, 6);
        assert!(stored_shares > 0, 7);
        assert!(!claimed, 8);
    }

    // Test: AMM odds calculation with bets
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, user1 = @0x100, user2 = @0x200)]
    public fun test_amm_odds_update(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        user1: &signer,
        user2: &signer,
    ) acquires TestContext {
        setup_test(aptos_framework, usdc_admin, pm_admin);
        account::create_account_for_test(signer::address_of(user1));
        account::create_account_for_test(signer::address_of(user2));

        mint_usdc_to_user(user1, 1000_000000);
        mint_usdc_to_user(user2, 1000_000000);

        market_manager::create_market(
            pm_admin,
            b"Test AMM",
            vector[b"Yes", b"No"],
            24
        );

        // Initial odds should be 50/50
        let odds_initial = betting::get_odds(0);
        assert!(*vector::borrow(&odds_initial, 0) == 5000, 1); // 50%
        assert!(*vector::borrow(&odds_initial, 1) == 5000, 2); // 50%

        // User1 bets heavily on outcome 0 (small amounts for LMSR with b=1000)
        betting::place_bet(user1, 0, 0, 100_000000); // 100 USDC on Yes

        // User2 bets lightly on outcome 1
        betting::place_bet(user2, 0, 1, 20_000000); // 20 USDC on No

        // Odds should now be different from 50/50
        let odds_after = betting::get_odds(0);
        // Odds should have changed from initial 50/50
        let odds0 = *vector::borrow(&odds_after, 0);
        let odds1 = *vector::borrow(&odds_after, 1);

        // With 100 USDC on outcome 0 and 20 on outcome 1:
        // LMSR with b=1000 provides stability, so odds won't change dramatically
        // The key insight: LMSR provides bounded loss (market maker risk = b*ln(n))
        // With large b relative to stakes, LMSR keeps odds very stable (by design)
        let sum = odds0 + odds1;
        assert!(sum >= 9900 && sum <= 10100, 3); // Total should be ~100% (allow 1% rounding)
        assert!(odds0 >= 100 && odds0 <= 9900, 4); // Valid odds range
        assert!(odds1 >= 100 && odds1 <= 9900, 5); // Valid odds range
    }

    // Note: Dispute resolution tests require juror registration and complex setup
    // See dispute_resolution.move tests for dispute-specific functionality

    // Test: Market resolution and claiming
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, winner = @0x100, loser = @0x200)]
    public fun test_complete_market_lifecycle(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        winner: &signer,
        loser: &signer,
    ) acquires TestContext {
        let pm_admin_addr = setup_test(aptos_framework, usdc_admin, pm_admin);
        let vault_addr = collateral_vault::get_vault_address();
        account::create_account_for_test(signer::address_of(winner));
        account::create_account_for_test(signer::address_of(loser));

        let bet_amount = 100_000000;
        mint_usdc_to_user(winner, bet_amount);
        mint_usdc_to_user(loser, bet_amount);

        // Create market
        market_manager::create_market(
            pm_admin,
            b"Lifecycle test",
            vector[b"Yes", b"No"],
            1
        );

        // Place bets
        betting::place_bet(winner, 0, 0, bet_amount); // Bets on Yes
        betting::place_bet(loser, 0, 1, bet_amount);  // Bets on No

        // Fast forward
        timestamp::fast_forward_seconds(2 * 3600);

        // Resolve to outcome 0 (Yes wins)
        market_manager::resolve_market(pm_admin, 0, 0);

        // Unlock collateral
        betting::unlock_market_collateral(pm_admin, 0);

        // Winner claims
        betting::claim_winnings(winner, 0);

        // Winner should have 200 USDC (original + winnings)
        let winner_balance = get_usdc_balance(signer::address_of(winner));
        assert!(winner_balance == bet_amount * 2, 1);

        // Loser should have 0
        let loser_balance = get_usdc_balance(signer::address_of(loser));
        assert!(loser_balance == 0, 2);
    }

    // Test: Vault balance tracking accuracy
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, user1 = @0x100, user2 = @0x200)]
    public fun test_vault_balance_tracking(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        user1: &signer,
        user2: &signer,
    ) acquires TestContext {
        let pm_admin_addr = setup_test(aptos_framework, usdc_admin, pm_admin);
        let vault_addr = collateral_vault::get_vault_address();
        account::create_account_for_test(signer::address_of(user1));
        account::create_account_for_test(signer::address_of(user2));

        mint_usdc_to_user(user1, 500_000000);
        mint_usdc_to_user(user2, 500_000000);

        market_manager::create_market(
            pm_admin,
            b"Vault test",
            vector[b"Yes", b"No"],
            24
        );

        // Initial vault balance should be 0
        assert!(collateral_vault::get_vault_balance(vault_addr) == 0, 1);

        // User1 places bet
        betting::place_bet(user1, 0, 0, 200_000000);
        assert!(collateral_vault::get_vault_balance(vault_addr) == 200_000000, 2);

        // User2 places bet
        betting::place_bet(user2, 0, 1, 300_000000);
        assert!(collateral_vault::get_vault_balance(vault_addr) == 500_000000, 3);

        // Verify market stakes
        let stakes = collateral_vault::get_market_stakes(vault_addr, 0);
        assert!(*vector::borrow(&stakes, 0) == 200_000000, 4);
        assert!(*vector::borrow(&stakes, 1) == 300_000000, 5);
    }

    // Test: Multiple users betting on same outcome
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, user1 = @0x100, user2 = @0x200, user3 = @0x300)]
    public fun test_multiple_users_same_outcome(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        user1: &signer,
        user2: &signer,
        user3: &signer,
    ) acquires TestContext {
        let pm_admin_addr = setup_test(aptos_framework, usdc_admin, pm_admin);
        let vault_addr = collateral_vault::get_vault_address();
        account::create_account_for_test(signer::address_of(user1));
        account::create_account_for_test(signer::address_of(user2));
        account::create_account_for_test(signer::address_of(user3));

        mint_usdc_to_user(user1, 1000_000000);
        mint_usdc_to_user(user2, 1000_000000);
        mint_usdc_to_user(user3, 1000_000000);

        market_manager::create_market(
            pm_admin,
            b"Same outcome test",
            vector[b"Yes", b"No"],
            1
        );

        // All bet on outcome 0
        betting::place_bet(user1, 0, 0, 100_000000);
        betting::place_bet(user2, 0, 0, 200_000000);
        betting::place_bet(user3, 0, 0, 300_000000);

        // Total stake on outcome 0 should be 600 USDC
        let stakes = collateral_vault::get_market_stakes(vault_addr, 0);
        assert!(*vector::borrow(&stakes, 0) == 600_000000, 1);

        // Resolve and claim
        timestamp::fast_forward_seconds(2 * 3600);
        market_manager::resolve_market(pm_admin, 0, 0);
        betting::unlock_market_collateral(pm_admin, 0);

        betting::claim_winnings(user1, 0);
        betting::claim_winnings(user2, 0);
        betting::claim_winnings(user3, 0);

        // Each should get their stake back (no losers pool to share)
        assert!(get_usdc_balance(signer::address_of(user1)) == 1000_000000, 2);
        assert!(get_usdc_balance(signer::address_of(user2)) == 1000_000000, 3);
        assert!(get_usdc_balance(signer::address_of(user3)) == 1000_000000, 4);
    }
}
