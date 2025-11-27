#[test_only]
module prediction_market::integration_tests {
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
    
    struct TestContext has key {
        mint_ref: MintRef,
        metadata: object::Object<fungible_asset::Metadata>,
    }
    
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
            let constructor_ref = object::create_named_object(usdc_admin, b"TUSDC_TEST");
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

        @prediction_market
    }
    
    fun mint_usdc_to_user(user: &signer, amount: u64) acquires TestContext {
        let context = borrow_global<TestContext>(@prediction_market);
        primary_fungible_store::mint(&context.mint_ref, signer::address_of(user), amount);
    }

    fun get_usdc_balance(addr: address): u64 acquires TestContext {
        let context = borrow_global<TestContext>(@prediction_market);
        primary_fungible_store::balance(addr, context.metadata)
    }
    
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, user1 = @0x100, user2 = @0x200)]
    public fun test_complete_betting_flow(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        user1: &signer,
        user2: &signer,
    ) acquires TestContext {
        // Setup
        let pm_admin_addr = setup_test(aptos_framework, usdc_admin, pm_admin);
        let vault_addr = collateral_vault::get_vault_address();
        account::create_account_for_test(signer::address_of(user1));
        account::create_account_for_test(signer::address_of(user2));
        
        // Mint USDC to users
        let bet_amount = 100_000000; // 100 USDC
        mint_usdc_to_user(user1, bet_amount);
        mint_usdc_to_user(user2, bet_amount);
        
        // Verify balances
        assert!(get_usdc_balance(signer::address_of(user1)) == bet_amount, 1);
        assert!(get_usdc_balance(signer::address_of(user2)) == bet_amount, 2);
        
        // Create market
        market_manager::create_market(
            pm_admin,
            b"Will BTC hit $100k by end of 2025?",
            vector[b"Yes", b"No"],
            24, // 24 hours
        );
        
        // Verify market created
        let market_count = market_manager::get_market_count();
        assert!(market_count == 1, 3);
        
        // User1 bets on outcome 0 (Yes), User2 bets on outcome 1 (No)
        betting::place_bet(user1, 0, 0, bet_amount); // market_id=0, outcome=0
        betting::place_bet(user2, 0, 1, bet_amount); // market_id=0, outcome=1
        
        // Verify USDC transferred to vault
        assert!(get_usdc_balance(signer::address_of(user1)) == 0, 4);
        assert!(get_usdc_balance(signer::address_of(user2)) == 0, 5);
        
        let vault_balance = collateral_vault::get_vault_balance(vault_addr);
        assert!(vault_balance == bet_amount * 2, 6);
        
        // Check market stakes
        let stakes = collateral_vault::get_market_stakes(vault_addr, 0);
        assert!(vector::length(&stakes) == 2, 7);
        assert!(*vector::borrow(&stakes, 0) == bet_amount, 8);
        assert!(*vector::borrow(&stakes, 1) == bet_amount, 9);
        
        // Wait for market to end
        timestamp::fast_forward_seconds(25 * 3600); // Move past end time
        
        // Resolve market - outcome 0 (Yes) wins
        market_manager::resolve_market(pm_admin, 0, 0);
        
        // Unlock collateral
        betting::unlock_market_collateral(pm_admin, 0);
        
        // User1 claims winnings
        betting::claim_winnings(user1, 0);
        
        // User1 should have 200 USDC (their stake + winnings)
        let user1_final_balance = get_usdc_balance(signer::address_of(user1));
        assert!(user1_final_balance == bet_amount * 2, 10);
        
        // User2 lost, should have 0
        assert!(get_usdc_balance(signer::address_of(user2)) == 0, 11);
    }
    
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, user = @0x100)]
    public fun test_multiple_bets_same_outcome(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        user: &signer,
    ) acquires TestContext {
        let pm_admin_addr = setup_test(aptos_framework, usdc_admin, pm_admin);
        let vault_addr = collateral_vault::get_vault_address();
        account::create_account_for_test(signer::address_of(user));
        
        // Give user 1000 USDC
        mint_usdc_to_user(user, 1000_000000);
        
        // Create market
        market_manager::create_market(
            pm_admin,
            b"Test market",
            vector[b"Yes", b"No"],
            24,
        );
        
        // Place multiple bets on same outcome
        betting::place_bet(user, 0, 0, 100_000000); // 100 USDC
        betting::place_bet(user, 0, 0, 200_000000); // 200 USDC
        betting::place_bet(user, 0, 0, 300_000000); // 300 USDC
        
        // Verify position
        let (outcome, stake, shares, claimed) = collateral_vault::get_user_position(signer::address_of(user), 0);
        assert!(outcome == 0, 1);
        assert!(stake == 600_000000, 2); // Total 600 USDC
        assert!(shares > 0, 3);
        assert!(!claimed, 4);

        // Verify remaining balance
        assert!(get_usdc_balance(signer::address_of(user)) == 400_000000, 5);
    }
    
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, user = @0x100)]
    #[expected_failure(abort_code = 0x10006, location = prediction_market::betting)]
    public fun test_bet_below_minimum(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        user: &signer,
    ) acquires TestContext {
        setup_test(aptos_framework, usdc_admin, pm_admin);
        account::create_account_for_test(signer::address_of(user));
        
        mint_usdc_to_user(user, 10_000000);
        
        market_manager::create_market(
            pm_admin,
            b"Test",
            vector[b"Yes", b"No"],
            24,
        );
        
        // Try to bet 0.5 USDC (below 1 USDC minimum)
        betting::place_bet(user, 0, 0, 500000);
    }
    
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, user = @0x100)]
    #[expected_failure(abort_code = 0x30001, location = prediction_market::betting)]
    public fun test_bet_on_expired_market(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        user: &signer,
    ) acquires TestContext {
        setup_test(aptos_framework, usdc_admin, pm_admin);
        account::create_account_for_test(signer::address_of(user));
        
        mint_usdc_to_user(user, 100_000000);
        
        market_manager::create_market(
            pm_admin,
            b"Test",
            vector[b"Yes", b"No"],
            1, // 1 hour
        );
        
        // Wait for market to expire
        timestamp::fast_forward_seconds(2 * 3600);
        
        // Try to bet after expiration
        betting::place_bet(user, 0, 0, 10_000000);
    }
    
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market)]
    public fun test_odds_calculation(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
    ) acquires TestContext {
        setup_test(aptos_framework, usdc_admin, pm_admin);
        
        market_manager::create_market(
            pm_admin,
            b"Test",
            vector[b"Yes", b"No"],
            24,
        );
        
        // Initial odds should be equal (50/50 = 5000 basis points each)
        let odds = betting::get_odds(0);
        assert!(vector::length(&odds) == 2, 1);
        assert!(*vector::borrow(&odds, 0) == 5000, 2); // 50%
        assert!(*vector::borrow(&odds, 1) == 5000, 3); // 50%
    }
    
    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, user = @0x100)]
    public fun test_faucet_functionality(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        user: &signer,
    ) acquires TestContext {
        setup_test(aptos_framework, usdc_admin, pm_admin);
        account::create_account_for_test(signer::address_of(user));
        
        // Mint tokens to user to simulate faucet
        mint_usdc_to_user(user, 1000_000000);

        // Should have 1000 USDC
        let balance = get_usdc_balance(signer::address_of(user));
        assert!(balance == 1000_000000, 1);
    }
}
