/// Pyth price reader for caching validated price snapshots per market.
/// Stores feed configuration, relayer permissions, and the latest snapshot
/// so the rest of the prediction market can safely reuse Pyth data.
module prediction_market::pyth_reader {
    use std::signer;
    use std::vector;
    use aptos_framework::account;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::timestamp;
    use aptos_std::option::{Self, Option};
    use aptos_std::table::{Self, Table};

    friend prediction_market::oracle;

    /// Errors
    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_NOT_AUTHORIZED: u64 = 3;
    const E_MARKET_NOT_REGISTERED: u64 = 4;
    const E_STALE_PRICE: u64 = 5;
    const E_INVALID_FEED_ID: u64 = 6;
    const E_DUPLICATE_VAA: u64 = 7;
    const E_PUBLISH_TIME_REGRESSION: u64 = 8;
    const E_INVALID_VAA_HASH: u64 = 9;

    /// Global configuration and storage
    struct GlobalConfig has key {
        admin: address,
        pyth_contract: address,
        price_service: address,
        relayers: Table<address, bool>,
        feeds: Table<u64, FeedConfig>,            // market_id -> feed config
        price_snapshots: Table<u64, PriceSnapshot>,
        update_events: EventHandle<PriceUpdateEvent>,
    }

    /// Stored configuration per market
    public struct FeedConfig has store, drop {
        feed_id: vector<u8>,           // 32 bytes price feed identifier
        staleness_threshold_secs: u64,
    }

    /// Cached snapshot of the latest verified price information
    public struct PriceSnapshot has store, drop {
        price: u128,
        price_negative: bool,
        confidence: u64,
        expo: u64,
        expo_negative: bool,
        publish_time: u64,
        received_at: u64,
        vaa_hash: vector<u8>,          // 32 bytes hash of processed VAA
    }

    /// Event emitted whenever a new price snapshot is stored
    struct PriceUpdateEvent has drop, store {
        market_id: u64,
        feed_id: vector<u8>,
        price: u128,
        price_negative: bool,
        confidence: u64,
        expo: u64,
        expo_negative: bool,
        publish_time: u64,
        received_at: u64,
        vaa_hash: vector<u8>,
        resolution_hint: Option<u8>,
    }

    /// Initialize global config
    public entry fun initialize(
        admin: &signer,
        pyth_contract: address,
        price_service: address,
    ) {
        let admin_addr = signer::address_of(admin);
        assert!(!exists<GlobalConfig>(@prediction_market), E_ALREADY_INITIALIZED);
        assert!(admin_addr == @prediction_market, E_NOT_AUTHORIZED);

        move_to(
            admin,
            GlobalConfig {
                admin: admin_addr,
                pyth_contract,
                price_service,
                relayers: table::new(),
                feeds: table::new(),
                price_snapshots: table::new(),
                update_events: account::new_event_handle<PriceUpdateEvent>(admin),
            },
        );
    }

    /// Register or update feed configuration for a market
    public entry fun register_feed(
        admin: &signer,
        market_id: u64,
        feed_id: vector<u8>,
        staleness_threshold_secs: u64,
    ) acquires GlobalConfig {
        assert!(exists<GlobalConfig>(@prediction_market), E_NOT_INITIALIZED);
        let config = borrow_global_mut<GlobalConfig>(@prediction_market);
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == config.admin, E_NOT_AUTHORIZED);
        assert!(vector::length(&feed_id) == 32, E_INVALID_FEED_ID);

        let feed = FeedConfig {
            feed_id,
            staleness_threshold_secs,
        };

        if (table::contains(&config.feeds, market_id)) {
            let existing = table::borrow_mut(&mut config.feeds, market_id);
            *existing = feed;
        } else {
            table::add(&mut config.feeds, market_id, feed);
        };
    }

    /// Remove feed configuration for a market
    public entry fun unregister_feed(
        admin: &signer,
        market_id: u64,
    ) acquires GlobalConfig {
        assert!(exists<GlobalConfig>(@prediction_market), E_NOT_INITIALIZED);
        let config = borrow_global_mut<GlobalConfig>(@prediction_market);
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == config.admin, E_NOT_AUTHORIZED);

        if (table::contains(&config.feeds, market_id)) {
            table::remove(&mut config.feeds, market_id);
        };
        if (table::contains(&config.price_snapshots, market_id)) {
            table::remove(&mut config.price_snapshots, market_id);
        };
    }

    /// Authorize a relayer address
    public entry fun add_relayer(
        admin: &signer,
        relayer: address,
    ) acquires GlobalConfig {
        assert!(exists<GlobalConfig>(@prediction_market), E_NOT_INITIALIZED);
        let config = borrow_global_mut<GlobalConfig>(@prediction_market);
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == config.admin, E_NOT_AUTHORIZED);

        if (table::contains(&config.relayers, relayer)) {
            *table::borrow_mut(&mut config.relayers, relayer) = true;
        } else {
            table::add(&mut config.relayers, relayer, true);
        };
    }

    /// Revoke relayer authorization
    public entry fun remove_relayer(
        admin: &signer,
        relayer: address,
    ) acquires GlobalConfig {
        assert!(exists<GlobalConfig>(@prediction_market), E_NOT_INITIALIZED);
        let config = borrow_global_mut<GlobalConfig>(@prediction_market);
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == config.admin, E_NOT_AUTHORIZED);

        if (table::contains(&config.relayers, relayer)) {
            table::remove(&mut config.relayers, relayer);
        };
    }

    /// Submit a fresh price snapshot from an authorized relayer
    public entry fun submit_price_update(
        relayer: &signer,
        market_id: u64,
        price: u128,
        price_negative: bool,
        confidence: u64,
        expo: u64,
        expo_negative: bool,
        publish_time: u64,
        vaa_hash: vector<u8>,
        resolution_hint: Option<u8>,
    ) acquires GlobalConfig {
        assert!(exists<GlobalConfig>(@prediction_market), E_NOT_INITIALIZED);
        let config = borrow_global_mut<GlobalConfig>(@prediction_market);
        let relayer_addr = signer::address_of(relayer);
        assert!(is_relayer_authorized_internal(&config.relayers, relayer_addr), E_NOT_AUTHORIZED);
        assert!(table::contains(&config.feeds, market_id), E_MARKET_NOT_REGISTERED);
        assert!(vector::length(&vaa_hash) == 32, E_INVALID_VAA_HASH);

        let now = timestamp::now_seconds();
        let feed_cfg = table::borrow(&config.feeds, market_id);

        let elapsed = if (now > publish_time) {
            now - publish_time
        } else {
            0
        };
        assert!(elapsed <= feed_cfg.staleness_threshold_secs, E_STALE_PRICE);

        if (table::contains(&config.price_snapshots, market_id)) {
            let existing = table::borrow(&config.price_snapshots, market_id);
            assert!(publish_time >= existing.publish_time, E_PUBLISH_TIME_REGRESSION);
            assert!(
                !bytes_equal(&vaa_hash, &existing.vaa_hash),
                E_DUPLICATE_VAA
            );
        };

        let snapshot = PriceSnapshot {
            price,
            price_negative,
            confidence,
            expo,
            expo_negative,
            publish_time,
            received_at: now,
            vaa_hash: clone_bytes(&vaa_hash),
        };

        if (table::contains(&config.price_snapshots, market_id)) {
            let existing = table::borrow_mut(&mut config.price_snapshots, market_id);
            *existing = snapshot;
        } else {
            table::add(&mut config.price_snapshots, market_id, snapshot);
        };

        let feed_id_copy = clone_bytes(&feed_cfg.feed_id);

        event::emit_event(
            &mut config.update_events,
            PriceUpdateEvent {
                market_id,
                feed_id: feed_id_copy,
                price,
                price_negative,
                confidence,
                expo,
                expo_negative,
                publish_time,
                received_at: now,
                vaa_hash,
                resolution_hint,
            },
        );
    }

    /// View: fetch feed configuration if present
    #[view]
    public fun get_feed_config(market_id: u64): Option<FeedConfig> acquires GlobalConfig {
        if (!exists<GlobalConfig>(@prediction_market)) {
            return option::none<FeedConfig>()
        };

        let config = borrow_global<GlobalConfig>(@prediction_market);
        if (!table::contains(&config.feeds, market_id)) {
            return option::none<FeedConfig>()
        };

        let feed_ref = table::borrow(&config.feeds, market_id);
        option::some(FeedConfig {
            feed_id: clone_bytes(&feed_ref.feed_id),
            staleness_threshold_secs: feed_ref.staleness_threshold_secs,
        })
    }

    /// View: retrieve cached price snapshot
    #[view]
    public fun get_price_snapshot(market_id: u64): Option<PriceSnapshot> acquires GlobalConfig {
        if (!exists<GlobalConfig>(@prediction_market)) {
            return option::none<PriceSnapshot>()
        };

        let config = borrow_global<GlobalConfig>(@prediction_market);
        if (!table::contains(&config.price_snapshots, market_id)) {
            return option::none<PriceSnapshot>()
        };

        let snapshot_ref = table::borrow(&config.price_snapshots, market_id);
        option::some(PriceSnapshot {
            price: snapshot_ref.price,
            price_negative: snapshot_ref.price_negative,
            confidence: snapshot_ref.confidence,
            expo: snapshot_ref.expo,
            expo_negative: snapshot_ref.expo_negative,
            publish_time: snapshot_ref.publish_time,
            received_at: snapshot_ref.received_at,
            vaa_hash: clone_bytes(&snapshot_ref.vaa_hash),
        })
    }

    /// View: determine if a cached snapshot is fresh within the supplied threshold
    #[view]
    public fun is_snapshot_fresh(
        market_id: u64,
        freshness_secs: u64,
    ): bool acquires GlobalConfig {
        if (!exists<GlobalConfig>(@prediction_market)) {
            return false
        };

        let config = borrow_global<GlobalConfig>(@prediction_market);
        if (!table::contains(&config.price_snapshots, market_id)) {
            return false
        };

        let snapshot = table::borrow(&config.price_snapshots, market_id);
        let now = timestamp::now_seconds();
        let elapsed = if (now > snapshot.publish_time) {
            now - snapshot.publish_time
        } else {
            0
        };
        elapsed <= freshness_secs
    }

    /// Friend helper for oracle module: check if snapshot exists
    public(friend) fun has_price_snapshot(market_id: u64): bool acquires GlobalConfig {
        if (!exists<GlobalConfig>(@prediction_market)) {
            return false
        };
        let config = borrow_global<GlobalConfig>(@prediction_market);
        table::contains(&config.price_snapshots, market_id)
    }

    /// Friend helper for oracle module: get snapshot data as tuple
    public(friend) fun get_snapshot_data(
        market_id: u64,
    ): (u128, bool, u64, bool, u64) acquires GlobalConfig {
        let config = borrow_global<GlobalConfig>(@prediction_market);
        let snapshot = table::borrow(&config.price_snapshots, market_id);
        (snapshot.price, snapshot.price_negative, snapshot.expo, snapshot.expo_negative, snapshot.publish_time)
    }

    /// Friend helper for oracle module: get full snapshot data
    public(friend) fun get_full_snapshot_data(
        market_id: u64,
    ): (u128, bool, u64, u64, bool, u64, u64) acquires GlobalConfig {
        let config = borrow_global<GlobalConfig>(@prediction_market);
        let snapshot = table::borrow(&config.price_snapshots, market_id);
        (snapshot.price, snapshot.price_negative, snapshot.confidence, snapshot.expo, snapshot.expo_negative, snapshot.publish_time, snapshot.received_at)
    }

    /// Friend helper for oracle module: get staleness threshold
    public(friend) fun get_staleness_threshold(
        market_id: u64,
    ): u64 acquires GlobalConfig {
        let config = borrow_global<GlobalConfig>(@prediction_market);
        let feed_cfg = table::borrow(&config.feeds, market_id);
        feed_cfg.staleness_threshold_secs
    }

    /// Internal helper: determine if relayer is authorized
    fun is_relayer_authorized_internal(
        relayers: &Table<address, bool>,
        relayer: address,
    ): bool {
        if (!table::contains(relayers, relayer)) {
            return false
        };
        *table::borrow(relayers, relayer)
    }

    /// Byte-wise equality for vector<u8>
    fun bytes_equal(a: &vector<u8>, b: &vector<u8>): bool {
        let len = vector::length(a);
        if (len != vector::length(b)) {
            return false
        };

        let i = 0;
        while (i < len) {
            if (*vector::borrow(a, i) != *vector::borrow(b, i)) {
                return false
            };
            i = i + 1;
        };
        true
    }

    /// Clone a vector<u8> into a fresh allocation
    fun clone_bytes(data: &vector<u8>): vector<u8> {
        let cloned = vector::empty<u8>();
        let i = 0;
        let len = vector::length(data);
        while (i < len) {
            vector::push_back(&mut cloned, *vector::borrow(data, i));
            i = i + 1;
        };
        cloned
    }

    // Getter functions for PriceSnapshot fields
    public fun snapshot_price(snap: &PriceSnapshot): u128 { snap.price }
    public fun snapshot_price_negative(snap: &PriceSnapshot): bool { snap.price_negative }
    public fun snapshot_confidence(snap: &PriceSnapshot): u64 { snap.confidence }
    public fun snapshot_expo(snap: &PriceSnapshot): u64 { snap.expo }
    public fun snapshot_expo_negative(snap: &PriceSnapshot): bool { snap.expo_negative }
    public fun snapshot_publish_time(snap: &PriceSnapshot): u64 { snap.publish_time }
    public fun snapshot_received_at(snap: &PriceSnapshot): u64 { snap.received_at }

    // Getter functions for FeedConfig fields
    public fun feed_staleness_threshold(feed: &FeedConfig): u64 { feed.staleness_threshold_secs }
}
