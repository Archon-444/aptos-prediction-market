/// Development USDC module for testing
/// DO NOT USE IN PRODUCTION
module prediction_market::usdc_dev {
    use std::signer;
    use std::string;
    use aptos_framework::coin::{Self, MintCapability, BurnCapability};

    /// USDC coin type for development
    struct USDC {}

    /// Capabilities holder
    struct Capabilities has key {
        mint_cap: MintCapability<USDC>,
        burn_cap: BurnCapability<USDC>,
    }

    /// Initialize USDC (testnet only)
    public entry fun initialize(account: &signer) {
        let (burn_cap, freeze_cap, mint_cap) = coin::initialize<USDC>(
            account,
            string::utf8(b"USD Coin (Dev)"),
            string::utf8(b"USDC"),
            6, // 6 decimals like real USDC
            true,
        );

        coin::destroy_freeze_cap(freeze_cap);

        move_to(account, Capabilities {
            mint_cap,
            burn_cap,
        });
    }
    
    /// Mint USDC (testnet only - anyone can call)
    public entry fun mint(account: &signer, amount: u64) acquires Capabilities {
        let account_addr = signer::address_of(account);
        
        if (!coin::is_account_registered<USDC>(account_addr)) {
            coin::register<USDC>(account);
        };
        
        let caps = borrow_global<Capabilities>(@prediction_market);
        let coins = coin::mint<USDC>(amount, &caps.mint_cap);
        coin::deposit(account_addr, coins);
    }
    
    /// Faucet - mint 1000 USDC
    public entry fun faucet(account: &signer) acquires Capabilities {
        mint(account, 1000_000000); // 1000 USDC
    }
}
