#!/bin/bash
# Verify admin roles on both chains
# This script checks on-chain role assignments

set -e

APTOS_WALLET="0x99b343076f69086476524bdc410f34284581424eb20679155c34f3e90cfd596f"
SUI_WALLET="0xd1c482bc55fa881bde37ff2fabc2e18dfa0304e01e7890b6c30e06c00562617f"
MODULE_ADDRESS="0x1c3fe17f5aa56e35440efa7835e78e767b8c7d2ed0c3378d55facf6920c6cc81"
PACKAGE_ID="0x7634cdd3e628a9bf3c42ddbc4282649ed30cdc06d6e17e28df09729ecb6ea1fb"
ROLE_REGISTRY_ID="0x45a425fe9b5c6120b046bffa91fe6bba43758503676cd2e24e390f0a7f5b30b3"

echo "=================================================="
echo "Verifying Admin Roles On-Chain"
echo "=================================================="
echo ""

# Verify Aptos
echo "1. APTOS - Checking wallet: $APTOS_WALLET"
echo "   Network: Testnet"
echo "   Module: $MODULE_ADDRESS"
echo ""

cd "$(dirname "$0")/../contracts"

echo "   Running view function..."
aptos move view \
  --function-id "${MODULE_ADDRESS}::access_control::get_user_roles" \
  --args address:"${APTOS_WALLET}" \
  --profile testnet-deploy

echo ""
echo "   Checking is_admin..."
aptos move view \
  --function-id "${MODULE_ADDRESS}::access_control::is_admin" \
  --args address:"${APTOS_WALLET}" \
  --profile testnet-deploy

echo ""
echo "=================================================="
echo ""

# Verify Sui
echo "2. SUI - Checking wallet: $SUI_WALLET"
echo "   Network: Testnet"
echo "   Package: $PACKAGE_ID"
echo "   Registry: $ROLE_REGISTRY_ID"
echo ""

echo "   Note: Sui role verification requires calling the view function"
echo "   You can verify in Sui Explorer:"
echo "   https://suiexplorer.com/object/${ROLE_REGISTRY_ID}?network=testnet"

echo ""
echo "=================================================="
echo "Verification Complete"
echo "=================================================="
echo ""
echo "Expected results:"
echo "- Aptos wallet should have role [0] (ROLE_ADMIN)"
echo "- is_admin should return true"
echo "- Sui wallet should have role 0 in the RoleRegistry"
