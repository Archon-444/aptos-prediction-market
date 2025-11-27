#!/bin/bash
# Grant admin role on Sui to specified wallet
# Usage: ./grant-sui-admin.sh <wallet_address>

set -e

WALLET_ADDRESS="${1:-0xd1c482bc55fa881bde37ff2fabc2e18dfa0304e01e7890b6c30e06c00562617f}"
PACKAGE_ID="0x7634cdd3e628a9bf3c42ddbc4282649ed30cdc06d6e17e28df09729ecb6ea1fb"
ROLE_REGISTRY_ID="0x45a425fe9b5c6120b046bffa91fe6bba43758503676cd2e24e390f0a7f5b30b3"
ROLE_ADMIN=0  # ROLE_ADMIN constant from access_control.move

echo "=================================================="
echo "Granting Admin Role on Sui"
echo "=================================================="
echo "Wallet: $WALLET_ADDRESS"
echo "Package: $PACKAGE_ID"
echo "Role Registry: $ROLE_REGISTRY_ID"
echo "Role: ROLE_ADMIN ($ROLE_ADMIN)"
echo "Network: Testnet"
echo "=================================================="
echo ""

# First, check if we need to find the AdminCap object for access_control
echo "Finding access_control AdminCap object..."
ADMIN_CAP=$(sui client objects --json 2>/dev/null | jq -r ".[] | select(.data.type == \"${PACKAGE_ID}::access_control::AdminCap\") | .data.objectId" | head -1)

if [ -z "$ADMIN_CAP" ]; then
  echo "❌ Error: access_control AdminCap object not found in your wallet"
  echo "You need to be the deployer or have the AdminCap to grant roles"
  echo "Package ID: $PACKAGE_ID"
  exit 1
fi

echo "Found AdminCap: $ADMIN_CAP"
echo ""

# Execute the grant_role entry function
echo "Executing grant_role transaction..."

# Note: TxContext is automatically added by Sui, so we don't include it in --args
# For u8 arguments, we just pass the number directly
sui client call \
  --package "$PACKAGE_ID" \
  --module access_control \
  --function grant_role \
  --args "$ADMIN_CAP" "$ROLE_REGISTRY_ID" "$WALLET_ADDRESS" "$ROLE_ADMIN" \
  --gas-budget 10000000

echo ""
echo "✅ Admin role granted successfully!"
echo ""
echo "Next steps:"
echo "1. Sync to backend: curl -X POST http://localhost:3000/roles/sync -H 'Content-Type: application/json' -d '{\"walletAddress\":\"${WALLET_ADDRESS}\",\"chain\":\"sui\"}'"
echo "2. Check Admin Roles UI to verify"
