/// Commit-Reveal Scheme for Front-Running Protection
/// Users commit a hash of their bet, then reveal it after commit phase ends
module prediction_market::commit_reveal {
    use std::signer;
    use std::error;
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};
    use aptos_std::aptos_hash;

    friend prediction_market::betting;

    // Error codes
    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_COMMITTED: u64 = 2;
    const E_COMMIT_NOT_FOUND: u64 = 3;
    const E_COMMIT_PHASE_ENDED: u64 = 4;
    const E_REVEAL_PHASE_NOT_STARTED: u64 = 5;
    const E_REVEAL_PHASE_ENDED: u64 = 6;
    const E_INVALID_REVEAL: u64 = 7;
    const E_ALREADY_REVEALED: u64 = 8;
    const E_INVALID_NONCE: u64 = 9;
    const E_COMMIT_TOO_RECENT: u64 = 10;

    // Constants
    const COMMIT_PHASE_DURATION: u64 = 300;  // 5 minutes
    const REVEAL_PHASE_DURATION: u64 = 300;  // 5 minutes
    // SECURITY: Minimum time commitment must exist before reveal (prevents timing attacks)
    const MIN_COMMIT_DURATION: u64 = 30;  // 30 seconds minimum

    /// Commitment structure
    struct Commitment has store, drop {
        user: address,
        market_id: u64,
        commitment_hash: vector<u8>,  // Hash of (outcome || amount || nonce)
        committed_at: u64,
        revealed: bool,
    }

    /// Market commit-reveal tracking
    struct MarketCommitReveal has store {
        market_id: u64,
        commit_phase_start: u64,
        commit_phase_end: u64,
        reveal_phase_end: u64,
        commitments: Table<address, Commitment>,
    }

    /// Global commit-reveal storage
    struct CommitRevealStore has key {
        markets: Table<u64, MarketCommitReveal>,
    }

    /// Initialize commit-reveal system
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @prediction_market, error::permission_denied(E_NOT_INITIALIZED));
        assert!(!exists<CommitRevealStore>(@prediction_market), error::already_exists(E_NOT_INITIALIZED));

        move_to(admin, CommitRevealStore {
            markets: table::new(),
        });
    }

    /// Start commit phase for a market
    public(friend) fun start_commit_phase(market_id: u64) acquires CommitRevealStore {
        assert!(exists<CommitRevealStore>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let store = borrow_global_mut<CommitRevealStore>(@prediction_market);

        let now = timestamp::now_seconds();

        if (!table::contains(&store.markets, market_id)) {
            add_market_commit(&mut store.markets, market_id, now);
        } else {
            let market_cr = table::borrow_mut(&mut store.markets, market_id);
            reset_commit_phase(market_cr, now);
        };
    }

    /// Commit to a bet (Phase 1)
    /// commitment_hash = SHA3-256(market_id || outcome || amount || nonce)
    public entry fun commit_bet(
        user: &signer,
        market_id: u64,
        commitment_hash: vector<u8>,
    ) acquires CommitRevealStore {
        assert!(exists<CommitRevealStore>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let store = borrow_global_mut<CommitRevealStore>(@prediction_market);

        let user_addr = signer::address_of(user);
        let now = timestamp::now_seconds();

        if (!table::contains(&store.markets, market_id)) {
            add_market_commit(&mut store.markets, market_id, now);
        };

        let market_cr = table::borrow_mut(&mut store.markets, market_id);

        if (now > market_cr.reveal_phase_end) {
            reset_commit_phase(market_cr, now);
        };

        // Check we're in commit phase
        assert!(now >= market_cr.commit_phase_start, error::invalid_state(E_COMMIT_PHASE_ENDED));
        assert!(now <= market_cr.commit_phase_end, error::invalid_state(E_COMMIT_PHASE_ENDED));

        if (table::contains(&market_cr.commitments, user_addr)) {
            table::remove(&mut market_cr.commitments, user_addr);
        };

        // Validate hash length (SHA3-256 produces 32 bytes)
        assert!(vector::length(&commitment_hash) == 32, error::invalid_argument(E_INVALID_REVEAL));

        // Store commitment
        let commitment = Commitment {
            user: user_addr,
            market_id,
            commitment_hash,
            committed_at: now,
            revealed: false,
        };

        table::add(&mut market_cr.commitments, user_addr, commitment);
    }

    /// Reveal bet (Phase 2) - returns (outcome, amount) if valid
    public(friend) fun reveal_bet(
        user: address,
        market_id: u64,
        outcome: u8,
        amount: u64,
        nonce: vector<u8>,
    ): (u8, u64) acquires CommitRevealStore {
        assert!(exists<CommitRevealStore>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let store = borrow_global_mut<CommitRevealStore>(@prediction_market);

        assert!(table::contains(&store.markets, market_id), error::not_found(E_COMMIT_NOT_FOUND));
        let market_cr = table::borrow_mut(&mut store.markets, market_id);

        let now = timestamp::now_seconds();

        // Check we're in reveal phase
        assert!(now > market_cr.commit_phase_end, error::invalid_state(E_REVEAL_PHASE_NOT_STARTED));
        assert!(now <= market_cr.reveal_phase_end, error::invalid_state(E_REVEAL_PHASE_ENDED));

        // Check user has a commitment
        assert!(table::contains(&market_cr.commitments, user), error::not_found(E_COMMIT_NOT_FOUND));
        let commitment = table::borrow_mut(&mut market_cr.commitments, user);

        // Check not already revealed
        assert!(!commitment.revealed, error::invalid_state(E_ALREADY_REVEALED));

        // SECURITY: Enforce minimum commit duration to prevent timing attacks
        let commit_age = now - commitment.committed_at;
        assert!(commit_age >= MIN_COMMIT_DURATION, error::invalid_state(E_COMMIT_TOO_RECENT));

        // Validate nonce length (should be at least 16 bytes for security)
        assert!(vector::length(&nonce) >= 16, error::invalid_argument(E_INVALID_NONCE));

        // Reconstruct the hash: SHA3-256(market_id || outcome || amount || nonce)
        let message = vector::empty<u8>();
        vector::append(&mut message, to_bytes_u64(market_id));
        vector::append(&mut message, vector::singleton(outcome));
        vector::append(&mut message, to_bytes_u64(amount));
        vector::append(&mut message, nonce);

        let computed_hash = aptos_hash::keccak256(message);

        // Verify the hash matches the commitment
        assert!(computed_hash == commitment.commitment_hash, error::invalid_argument(E_INVALID_REVEAL));

        // Mark as revealed
        commitment.revealed = true;

        (outcome, amount)
    }

    /// Check if market is in commit phase
    #[view]
    public fun is_commit_phase(market_id: u64): bool acquires CommitRevealStore {
        if (!exists<CommitRevealStore>(@prediction_market)) {
            return false
        };
        let store = borrow_global<CommitRevealStore>(@prediction_market);

        if (!table::contains(&store.markets, market_id)) {
            return false
        };

        let market_cr = table::borrow(&store.markets, market_id);
        let now = timestamp::now_seconds();

        now >= market_cr.commit_phase_start && now <= market_cr.commit_phase_end
    }

    /// Check if market is in reveal phase
    #[view]
    public fun is_reveal_phase(market_id: u64): bool acquires CommitRevealStore {
        if (!exists<CommitRevealStore>(@prediction_market)) {
            return false
        };
        let store = borrow_global<CommitRevealStore>(@prediction_market);

        if (!table::contains(&store.markets, market_id)) {
            return false
        };

        let market_cr = table::borrow(&store.markets, market_id);
        let now = timestamp::now_seconds();

        now > market_cr.commit_phase_end && now <= market_cr.reveal_phase_end
    }

    /// Get commit/reveal phase info
    #[view]
    public fun get_phase_info(market_id: u64): (u64, u64, u64) acquires CommitRevealStore {
        assert!(exists<CommitRevealStore>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let store = borrow_global<CommitRevealStore>(@prediction_market);

        assert!(table::contains(&store.markets, market_id), error::not_found(E_COMMIT_NOT_FOUND));
        let market_cr = table::borrow(&store.markets, market_id);

        (market_cr.commit_phase_end, market_cr.reveal_phase_end, timestamp::now_seconds())
    }

    // Helper function to convert u64 to bytes
    fun to_bytes_u64(value: u64): vector<u8> {
        let bytes = vector::empty<u8>();
        let i = 0;
        while (i < 8) {
            vector::push_back(&mut bytes, ((value >> (i * 8)) & 0xFF as u8));
            i = i + 1;
        };
        bytes
    }

    fun add_market_commit(
        markets: &mut Table<u64, MarketCommitReveal>,
        market_id: u64,
        now: u64,
    ) {
        let market_cr = MarketCommitReveal {
            market_id,
            commit_phase_start: now,
            commit_phase_end: now + COMMIT_PHASE_DURATION,
            reveal_phase_end: now + COMMIT_PHASE_DURATION + REVEAL_PHASE_DURATION,
            commitments: table::new(),
        };

        table::add(markets, market_id, market_cr);
    }

    fun reset_commit_phase(market_cr: &mut MarketCommitReveal, start: u64) {
        market_cr.commit_phase_start = start;
        market_cr.commit_phase_end = start + COMMIT_PHASE_DURATION;
        market_cr.reveal_phase_end = market_cr.commit_phase_end + REVEAL_PHASE_DURATION;
    }
}
