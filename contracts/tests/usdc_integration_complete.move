#[test_only]
module prediction_market::usdc_integration_complete {
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
    use prediction_market::market_manager;
    use prediction_market::betting;

    struct TestContext has key {
        mint_ref: MintRef,
        metadata: object::Object<fungible_asset::Metadata>,
    }

    fun setup(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
    ) acquires TestContext {
        timestamp::set_time_has_started_for_testing(aptos_framework);
        account::create_account_for_test(@0x1);
        account::create_account_for_test(@0xcafe);
        account::create_account_for_test(@prediction_market);

        if (!exists<TestContext>(@prediction_market)) {
            let constructor_ref = object::create_named_object(usdc_admin, b"TUSDC_COMPLETE");
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
        collateral_vault::initialize(pm_admin, vector::singleton(1u8), metadata_addr);

        betting::initialize(pm_admin);
    }

    fun mint_usdc_to_user(user: &signer, amount: u64) acquires TestContext {
        let context = borrow_global<TestContext>(@prediction_market);
        primary_fungible_store::mint(&context.mint_ref, signer::address_of(user), amount);
    }

    fun get_usdc_balance(addr: address): u64 acquires TestContext {
        let context = borrow_global<TestContext>(@prediction_market);
        primary_fungible_store::balance(addr, context.metadata)
    }

    #[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market, user1 = @0x123, user2 = @0x456)]
    public fun test_complete_usdc_flow(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
        user1: &signer,
        user2: &signer,
    ) acquires TestContext {
        setup(aptos_framework, usdc_admin, pm_admin);

        account::create_account_for_test(signer::address_of(user1));
        account::create_account_for_test(signer::address_of(user2));

        mint_usdc_to_user(user1, 1_000_000000);
        mint_usdc_to_user(user2, 1_000_000000);

        let balance1 = get_usdc_balance(signer::address_of(user1));
        let balance2 = get_usdc_balance(signer::address_of(user2));

        assert!(balance1 == 1_000_000000, 1);
        assert!(balance2 == 1_000_000000, 2);
    }
}
