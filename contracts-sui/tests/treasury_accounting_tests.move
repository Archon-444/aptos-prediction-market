// Treasury accounting invariants for native USDC flows.
#[test_only]
#[allow(duplicate_alias, unused_use)]
module prediction_market::treasury_accounting_tests {
    use prediction_market::global_treasury::{Self as treasury, ClaimTicket, GlobalTreasury};
    use prediction_market::test_harness;
    use circle_usdc::usdc::USDC;
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self as coin, Coin};
    use sui::object::{Self as object, ID};
    use sui::transfer;

    const ADMIN: address = @0xA11CE;
    const USER: address = @0xB0B;

    #[test]
    fun test_deposit_record_and_redeem_claim() {
        let (admin, mut scenario) = bootstrap_env();
        let _treasury_id = share_treasury(&mut scenario, admin);

        deposit_liquidity(&mut scenario, admin, 1_000_000_000);

        test_harness::finalize_tx(&mut scenario, admin);
        {
            let mut treasury_obj = test_harness::take_treasury(&scenario);
            let market_id = fresh_dummy_market_id(&mut scenario);
            let ticket = treasury::record_claim(&mut treasury_obj, market_id, USER, 500_000_000, ts::ctx(&mut scenario));
            assert!(treasury::total_claims(&treasury_obj) == 500_000_000, 0);
            transfer::public_transfer(ticket, USER);
            test_harness::return_shared(treasury_obj);
        };

        // User redeems ticket.
        test_harness::finalize_tx(&mut scenario, USER);
        {
            let mut treasury_obj = ts::take_shared<GlobalTreasury>(&scenario);
            let ticket = ts::take_from_sender<ClaimTicket>(&scenario);
            let payout = treasury::redeem_claim(&mut treasury_obj, ticket, ts::ctx(&mut scenario));
            assert!(coin::value(&payout) == 500_000_000, 1);
            // Recycle payout to keep liquidity stable.
            treasury::deposit_liquidity(&mut treasury_obj, payout);
            assert!(treasury::total_claims(&treasury_obj) == 0, 2);
            assert!(treasury::total_liquidity(&treasury_obj) == 1_000_000_000, 3);
            test_harness::return_shared(treasury_obj);
        };

        ts::end(scenario);
    }

    // --- helpers ---

    fun bootstrap_env(): (address, Scenario) {
        let admin = ADMIN;
        let mut scenario = test_harness::bootstrap(admin);
        test_harness::grant_protocol_roles(&mut scenario, admin, admin);
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

    fun fresh_dummy_market_id(scenario: &mut Scenario): ID {
        let uid = object::new(ts::ctx(scenario));
        let id = object::uid_to_inner(&uid);
        object::delete(uid);
        id
    }
}

