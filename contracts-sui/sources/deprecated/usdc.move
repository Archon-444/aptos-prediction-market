/// Test USDC coin for Sui testnet
/// This is a simple coin module that mimics USDC for testing purposes
module circle_usdc::usdc {
    use sui::coin;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::option;

    /// The USDC coin type
    public struct USDC has drop {}

    /// Initialize the USDC coin
    fun init(witness: USDC, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            6, // decimals (USDC has 6 decimals)
            b"USDC",
            b"USD Coin",
            b"Test USDC for prediction markets",
            option::none(),
            ctx
        );

        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury, tx_context::sender(ctx));
    }
}
