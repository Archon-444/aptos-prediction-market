#!/bin/bash
# Sync on-chain roles to backend for both wallets
# This script syncs roles from blockchain to the backend database

set -e

APTOS_WALLET="0x99b343076f69086476524bdc410f34284581424eb20679155c34f3e90cfd596f"
SUI_WALLET="0xd1c482bc55fa881bde37ff2fabc2e18dfa0304e01e7890b6c30e06c00562617f"
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"

echo "=================================================="
echo "Syncing Backend Roles"
echo "=================================================="
echo "Backend URL: $BACKEND_URL"
echo "=================================================="
echo ""

# Function to sync roles
sync_roles() {
  local wallet=$1
  local chain=$2

  echo "Syncing $chain roles for $wallet..."

  response=$(curl -s -X POST "${BACKEND_URL}/roles/sync" \
    -H "Content-Type: application/json" \
    -d "{\"walletAddress\":\"${wallet}\",\"chain\":\"${chain}\",\"actor\":\"admin\"}")

  if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
    echo "❌ Error syncing $chain: $(echo "$response" | jq -r '.error')"
    return 1
  else
    echo "✅ $chain roles synced successfully"
    echo "   Roles: $(echo "$response" | jq -r '.roles | join(", ")')"
    echo ""
    return 0
  fi
}

# Sync Aptos wallet
echo "1. Syncing Aptos Admin Wallet"
echo "   Address: $APTOS_WALLET"
sync_roles "$APTOS_WALLET" "aptos"

# Sync Sui wallet
echo "2. Syncing Sui Admin Wallet"
echo "   Address: $SUI_WALLET"
sync_roles "$SUI_WALLET" "sui"

echo "=================================================="
echo "✅ All roles synced!"
echo "=================================================="
echo ""
echo "Verify in Admin UI:"
echo "- Aptos wallet: $APTOS_WALLET"
echo "- Sui wallet: $SUI_WALLET"
echo ""
echo "Both should now show ROLE_ADMIN"
