#!/bin/bash
# Grant admin role on Aptos to specified wallet
# Usage: ./grant-aptos-admin.sh <wallet_address>

set -e

WALLET_ADDRESS="${1:-0x99b343076f69086476524bdc410f34284581424eb20679155c34f3e90cfd596f}"
MODULE_ADDRESS="0x1c3fe17f5aa56e35440efa7835e78e767b8c7d2ed0c3378d55facf6920c6cc81"
ROLE_ADMIN=0  # ROLE_ADMIN constant from access_control.move

echo "=================================================="
echo "Granting Admin Role on Aptos"
echo "=================================================="
echo "Wallet: $WALLET_ADDRESS"
echo "Module: $MODULE_ADDRESS"
echo "Role: ROLE_ADMIN ($ROLE_ADMIN)"
echo "Network: Testnet"
echo "=================================================="
echo ""

# Navigate to contracts directory
cd "$(dirname "$0")/../contracts"

# Execute the grant_role entry function
echo "Executing grant_role transaction..."
aptos move run \
  --function-id "${MODULE_ADDRESS}::access_control::grant_role" \
  --args address:"$WALLET_ADDRESS" u8:"$ROLE_ADMIN" \
  --profile testnet-deploy \
  --assume-yes

echo ""
echo "✅ Admin role granted successfully!"
echo ""
echo "Next steps:"
echo "1. Verify on-chain: aptos move view --function-id ${MODULE_ADDRESS}::access_control::get_user_roles --args address:${WALLET_ADDRESS} --profile testnet-deploy"
echo "2. Sync to backend: curl -X POST http://localhost:3000/roles/sync -H 'Content-Type: application/json' -d '{\"walletAddress\":\"${WALLET_ADDRESS}\",\"chain\":\"aptos\"}'"
echo "3. Check Admin Roles UI to verify"
