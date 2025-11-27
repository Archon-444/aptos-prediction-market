# Formal Verification Specification

**Tool:** Move Prover
**Status:** 🔴 Required before mainnet
**Estimated Time:** 2 weeks

---

## Overview

Formal verification mathematically proves that smart contracts behave correctly under all possible conditions. This is CRITICAL for financial contracts handling user funds.

### What Gets Verified

1. **Invariants** - Properties that must ALWAYS be true
2. **Pre-conditions** - Requirements before function execution
3. **Post-conditions** - Guarantees after function execution
4. **Aborts** - All possible failure cases are documented

---

## Installation

```bash
# Install Move Prover
cargo install --git https://github.com/move-language/move move-prover

# Install required tools
brew install z3 boogie

# Verify installation
move prove --help
```

---

## Verification Specifications

### Global Invariants

Add to `market_manager_v2_secure.move`:

```move
spec module {
    /// INVARIANT: Market pools always balance with total volume
    /// This prevents fund leakage
    invariant forall market: Market where market.status == 1:
        sum_all_shard_balances(market.id) == market.total_deposits;

    /// INVARIANT: Shares never exceed deposits
    /// Prevents share inflation attacks
    invariant forall shard: MarketPoolShard:
        shard.yes_shares <= balance::value(&shard.yes_balance) &&
        shard.no_shares <= balance::value(&shard.no_balance);

    /// INVARIANT: Settlement queue is monotonically increasing
    /// Ensures deterministic ordering
    invariant forall queue: SettlementQueue:
        is_sequence_sorted(queue.pending) &&
        forall i in 0..vector::length(&queue.pending):
            queue.pending[i].sequence_number == i;

    /// INVARIANT: Resolved markets cannot be modified
    /// Prevents result tampering
    invariant forall market: Market where market.status == 1:
        market.resolved_outcome != 255 &&
        old(market.status) == 1 ==> market.resolved_outcome == old(market.resolved_outcome);

    /// INVARIANT: Shard assignments are deterministic
    /// Same user always maps to same shard
    invariant forall user: address, market: Market:
        calculate_user_shard(user, market.num_shards) < market.num_shards &&
        calculate_user_shard(user, market.num_shards) ==
            calculate_user_shard(user, market.num_shards); // Idempotent
}
```

### Function Specifications

#### place_bet

```move
spec place_bet {
    /// Pre-condition: Market must be active
    requires market.status == 0;
    requires !market.paused;
    requires clock::timestamp_ms(clock) < market.end_timestamp;
    requires outcome == 0 || outcome == 1;

    /// Pre-condition: User assigned to correct shard
    requires pool.shard_id == calculate_user_shard(tx_context::sender(ctx), market.num_shards);
    requires pool.market_id == object::uid_to_inner(&market.id);

    /// Pre-condition: Payment is valid
    requires coin::value(&payment) > 0;

    /// Post-condition: Pool balance increased exactly by payment
    ensures pool.total_volume == old(pool.total_volume) + coin::value(&payment);

    /// Post-condition: Shares correctly assigned
    ensures if (outcome == 1) {
        pool.yes_shares == old(pool.yes_shares) + result_shares &&
        pool.no_shares == old(pool.no_shares)
    } else {
        pool.no_shares == old(pool.no_shares) + result_shares &&
        pool.yes_shares == old(pool.yes_shares)
    };

    /// Post-condition: Position created for user
    ensures exists<Position>(result_position_id) &&
           Position[result_position_id].owner == tx_context::sender(ctx);

    /// Aborts if: Market ended
    aborts_if clock::timestamp_ms(clock) >= market.end_timestamp with E_MARKET_EXPIRED;

    /// Aborts if: Market paused
    aborts_if market.paused with E_MARKET_PAUSED;

    /// Aborts if: Wrong shard
    aborts_if pool.shard_id != calculate_user_shard(tx_context::sender(ctx), market.num_shards)
        with E_WRONG_SHARD;

    /// Aborts if: Invalid outcome
    aborts_if outcome != 0 && outcome != 1 with E_INVALID_OUTCOME;
}
```

#### request_settlement

```move
spec request_settlement {
    /// Pre-condition: Market resolved
    requires market.status == 1;

    /// Pre-condition: Position belongs to market
    requires position.market_id == object::uid_to_inner(&market.id);

    /// Pre-condition: Queue belongs to market
    requires queue.market_id == object::uid_to_inner(&market.id);

    /// Post-condition: Sequence number incremented
    ensures queue.next_sequence == old(queue.next_sequence) + 1;

    /// Post-condition: Request added to queue (if winning position)
    ensures if (position.outcome == market.resolved_outcome) {
        vector::length(&queue.pending) == old(vector::length(&queue.pending)) + 1 &&
        queue.pending[vector::length(&queue.pending) - 1].sequence_number == old(queue.next_sequence)
    } else {
        // Losing position - no settlement added
        vector::length(&queue.pending) == old(vector::length(&queue.pending))
    };

    /// Post-condition: Sequence numbers remain sorted
    ensures is_sequence_sorted(queue.pending);

    /// Aborts if: Market not resolved
    aborts_if market.status != 1 with E_MARKET_ALREADY_RESOLVED;

    /// Aborts if: Position doesn't match market
    aborts_if position.market_id != object::uid_to_inner(&market.id) with E_NO_POSITION;
}
```

#### execute_settlements

```move
spec execute_settlements {
    /// Pre-condition: Market resolved
    requires market.status == 1;

    /// Pre-condition: Queue is sorted
    requires is_sequence_sorted(queue.pending);

    /// Post-condition: Processed count increases
    ensures queue.processed_count >= old(queue.processed_count);
    ensures queue.processed_count <= old(queue.processed_count) + max_to_process;

    /// Post-condition: Settlements processed in order
    ensures forall i in 0..min(max_to_process, vector::length(&old(queue.pending))):
        processed_settlements[i].sequence_number == old(queue.pending[0].sequence_number) + i;

    /// Post-condition: No settlements skipped
    ensures forall seq in old(queue.pending[0].sequence_number)..queue.processed_count:
        exists settlement where settlement.sequence_number == seq;

    /// Aborts if: Market not resolved
    aborts_if market.status != 1;
}
```

#### verify_price (Oracle Validator)

```move
spec oracle_validator::verify_price {
    /// Pre-condition: Price data is recent
    requires clock::timestamp_ms(clock) - price_data.timestamp <= MAX_PRICE_AGE_MS;

    /// Pre-condition: Source is whitelisted
    requires table::contains(&registry.whitelisted_sources, price_data.source) &&
             table::borrow(&registry.whitelisted_sources, price_data.source);

    /// Pre-condition: Circuit breaker not active
    requires !registry.circuit_breaker_active;

    /// Pre-condition: Price is reasonable
    requires price_data.price > 0 && price_data.price < 1_000_000_000_000;

    /// Post-condition: Returns validated price
    ensures result == price_data.price;

    /// Post-condition: PriceValidated event emitted
    ensures exists<PriceValidated>(event) where
        event.price == price_data.price &&
        event.source == price_data.source;

    /// Aborts if: Price too old
    aborts_if clock::timestamp_ms(clock) - price_data.timestamp > MAX_PRICE_AGE_MS
        with E_STALE_PRICE;

    /// Aborts if: Source not whitelisted
    aborts_if !table::contains(&registry.whitelisted_sources, price_data.source)
        with E_ORACLE_NOT_WHITELISTED;

    /// Aborts if: Circuit breaker active
    aborts_if registry.circuit_breaker_active with E_CIRCUIT_BREAKER_TRIGGERED;

    /// Aborts if: Price deviation too high
    aborts_if table::contains(&registry.last_prices, price_data.source) &&
              calculate_deviation(
                  table::borrow(&registry.last_prices, price_data.source),
                  price_data.price
              ) > MAX_PRICE_DEVIATION_BPS
        with E_PRICE_DEVIATION_TOO_HIGH;
}
```

### Helper Function Specifications

```move
spec calculate_user_shard {
    /// Always returns value less than num_shards
    ensures result < num_shards;

    /// Deterministic: same input always produces same output
    ensures result == calculate_user_shard(user, num_shards);

    /// Aborts if: num_shards is 0
    aborts_if num_shards == 0;
}

spec safe_multiply_with_precision {
    /// No overflow in u128 intermediate
    ensures (a as u128) * (b as u128) <= MAX_U128;

    /// Result fits in u64
    ensures result <= MAX_U64;

    /// Aborts if: Result would overflow u64
    aborts_if (a as u128) * (b as u128) > (MAX_U64 as u128) with E_OVERFLOW;
}

spec calculate_deviation {
    /// Result in valid range [0, 10000] (basis points)
    ensures result <= 10000;

    /// Symmetric: deviation(a,b) == deviation(b,a)
    ensures result == calculate_deviation(new_price, old_price);

    /// Returns 0 if prices identical
    ensures old_price == new_price ==> result == 0;

    /// Aborts if: Division by zero
    aborts_if old_price == 0;
}
```

---

## Running Verification

### Verify Entire Module

```bash
cd contracts-sui

# Verify market_manager_v2
move prove sources/market_manager_v2_secure.move

# Verify oracle_validator
move prove sources/oracle_validator.move

# Verify access_control
move prove sources/access_control.move
```

### Verify Specific Functions

```bash
# Verify just place_bet
move prove sources/market_manager_v2_secure.move --function place_bet

# Verify settlement functions
move prove sources/market_manager_v2_secure.move --function request_settlement
move prove sources/market_manager_v2_secure.move --function execute_settlements
```

### Verbose Output

```bash
# Show detailed verification steps
move prove sources/market_manager_v2_secure.move --verbose

# Generate verification report
move prove sources/market_manager_v2_secure.move --report verification-report.html
```

---

## Verification Checklist

**All must be verified before mainnet:**

- [ ] **Global Invariants**
  - [ ] Pool balance always equals total deposits
  - [ ] Shares never exceed deposits
  - [ ] Settlement queue is sorted
  - [ ] Resolved markets immutable

- [ ] **Market Functions**
  - [ ] create_market pre/post conditions
  - [ ] place_bet pre/post conditions
  - [ ] resolve_market pre/post conditions

- [ ] **Settlement Functions**
  - [ ] request_settlement determinism
  - [ ] execute_settlements ordering
  - [ ] claim_winnings correctness

- [ ] **Oracle Functions**
  - [ ] verify_price staleness checks
  - [ ] aggregate_prices median calculation
  - [ ] Circuit breaker enforcement

- [ ] **Safety Properties**
  - [ ] No integer overflow
  - [ ] No division by zero
  - [ ] No uninitialized memory
  - [ ] All aborts documented

---

## Common Verification Issues

### Issue: Timeout

**Symptom:** Prover times out on complex functions
**Solution:**
```move
// Split complex functions into smaller helpers
// Use `#[verify_only]` for helper functions

#[verify_only]
fun helper_function(...) { ... }
```

### Issue: Cannot Prove Invariant

**Symptom:** "Cannot prove invariant holds"
**Solution:**
```move
// Add intermediate assertions
assert!(condition, E_CODE);

// Or weaken invariant temporarily
invariant [conditional] condition where precondition;
```

### Issue: Quantifier Issues

**Symptom:** "Cannot instantiate quantifier"
**Solution:**
```move
// Use concrete bounds instead of forall when possible
invariant forall i in 0..vector::length(&v): v[i] > 0;
// Better than: invariant forall i: v[i] > 0;
```

---

## Success Criteria

**Verification passes when:**

1. ✅ All invariants proven
2. ✅ All pre-conditions satisfied
3. ✅ All post-conditions guaranteed
4. ✅ All aborts documented
5. ✅ No timeouts or errors
6. ✅ Coverage >95% of critical paths

---

## Integration with CI/CD

Add to `.github/workflows/sui-security-tests.yml`:

```yaml
- name: Run formal verification
  run: |
    move prove contracts-sui/sources/market_manager_v2_secure.move
    move prove contracts-sui/sources/oracle_validator.move
    move prove contracts-sui/sources/access_control.move

- name: Check verification coverage
  run: |
    move prove --coverage contracts-sui/sources/
    if [ $(cat coverage.json | jq '.coverage') -lt 95 ]; then
      echo "ERROR: Verification coverage < 95%"
      exit 1
    fi
```

---

## Resources

- [Move Prover Guide](https://github.com/move-language/move/tree/main/language/move-prover/doc)
- [Specification Language](https://github.com/move-language/move/blob/main/language/move-prover/doc/user/spec-lang.md)
- [Invariants](https://github.com/move-language/move/blob/main/language/move-prover/doc/user/spec-lang.md#invariants)

---

**Status:** 🔴 NOT STARTED - Required before mainnet
**Timeline:** 2 weeks
**Assigned:** Security Team + External Auditors
