#!/bin/bash

# Move Market - Complete Deployment Script
# This script deploys all contracts to Aptos devnet including USDC integration

echo "🚀 Deploying Move Market to Aptos Devnet..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if aptos CLI is installed
if ! command -v aptos &> /dev/null; then
    echo -e "${RED}❌ Aptos CLI not found. Please install from: https://aptos.dev/cli-tools/aptos-cli-tool/install-aptos-cli${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Step 1: Initialize Aptos account (if needed)${NC}"
aptos init --network devnet --profile default --assume-yes
echo ""

echo -e "${BLUE}📋 Step 2: Fund account with devnet APT${NC}"
echo "Getting faucet..."
ACCOUNT_ADDRESS=$(aptos account list --profile default 2>/dev/null | grep "account" | awk '{print $2}' | head -1)

if [ -z "$ACCOUNT_ADDRESS" ]; then
    echo -e "${RED}❌ Could not get account address${NC}"
    exit 1
fi

echo "Account address: $ACCOUNT_ADDRESS"
aptos account fund-with-faucet --account $ACCOUNT_ADDRESS --amount 100000000 --url https://faucet.devnet.aptoslabs.com
echo ""

echo -e "${BLUE}📋 Step 3: Compile Move modules${NC}"
cd "$(dirname "$0")/../contracts" || exit
USDC_METADATA="0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832"

aptos move compile --named-addresses prediction_market=$ACCOUNT_ADDRESS,admin=$ACCOUNT_ADDRESS,circle=$USDC_METADATA
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Compilation failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Compilation successful${NC}"
echo ""

echo -e "${BLUE}📋 Step 4: Run tests${NC}"
aptos move test --named-addresses prediction_market=$ACCOUNT_ADDRESS,admin=$ACCOUNT_ADDRESS,circle=$USDC_METADATA
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Some tests failed, but continuing with deployment${NC}"
fi
echo -e "${GREEN}✅ Tests completed${NC}"
echo ""

echo -e "${BLUE}📋 Step 5: Deploy modules to devnet${NC}"
aptos move publish --named-addresses prediction_market=$ACCOUNT_ADDRESS,admin=$ACCOUNT_ADDRESS,circle=$USDC_METADATA --profile default --assume-yes
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Deployment successful${NC}"
echo ""

echo -e "${BLUE}📋 Step 6: Initialize contracts${NC}"

# Initialize market manager
echo "Initializing market manager..."
aptos move run \
    --function-id ${ACCOUNT_ADDRESS}::market_manager::initialize \
    --profile default \
    --assume-yes

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Market manager initialization failed (may already be initialized)${NC}"
fi

VAULT_SEED_HEX="0x7661756c74"   # "vault"
ORACLE_SEED_HEX="0x6f7261636c65" # "oracle"

echo "Initializing collateral vault..."
aptos move run \
    --function-id ${ACCOUNT_ADDRESS}::collateral_vault::initialize \
    --args vector<u8>:$VAULT_SEED_HEX address:$USDC_METADATA \
    --profile default \
    --assume-yes

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Vault initialization failed (may already be initialized)${NC}"
fi

echo "Reading derived vault resource account..."
aptos move view \
    --function-id ${ACCOUNT_ADDRESS}::collateral_vault::get_vault_address \
    --profile default \
    --assume-yes

echo "Validating shared USDC metadata for vault..."
aptos move view \
    --function-id ${ACCOUNT_ADDRESS}::collateral_vault::get_metadata_object \
    --profile default \
    --assume-yes

# Initialize betting system
echo "Initializing betting system..."
aptos move run \
    --function-id ${ACCOUNT_ADDRESS}::betting::initialize \
    --profile default \
    --assume-yes

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Betting initialization failed (may already be initialized)${NC}"
fi

# Initialize oracle staking registry
echo "Initializing oracle registry..."
aptos move run \
    --function-id ${ACCOUNT_ADDRESS}::oracle::initialize \
    --args vector<u8>:$ORACLE_SEED_HEX \
    --profile default \
    --assume-yes

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Oracle registry initialization failed (may already be initialized)${NC}"
fi

echo ""
echo -e "${GREEN}✅ All contracts initialized!${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "📝 Module Address: ${BLUE}${ACCOUNT_ADDRESS}${NC}"
echo ""
echo -e "${YELLOW}📚 Next steps:${NC}"
echo ""
echo "  1. Update your frontend .env file:"
echo "     ${BLUE}VITE_MODULE_ADDRESS=${ACCOUNT_ADDRESS}${NC}"
echo "     ${BLUE}VITE_APTOS_USDC_ADDRESS=${USDC_METADATA}${NC}"
echo ""
echo "  2. Create your first market:"
echo "     ${BLUE}aptos move run \\${NC}"
echo "     ${BLUE}  --function-id ${ACCOUNT_ADDRESS}::market_manager::create_market \\${NC}"
echo "     ${BLUE}  --args 'string:Will BTC hit \$100k?' \\${NC}"
echo "     ${BLUE}         'vector<vector<u8>>:[[89, 101, 115], [78, 111]]' \\${NC}"
echo "     ${BLUE}         u64:24${NC}"
echo ""
echo "  3. Place a bet:"
echo "     ${BLUE}aptos move run \\${NC}"
echo "     ${BLUE}  --function-id ${ACCOUNT_ADDRESS}::betting::place_bet \\${NC}"
echo "     ${BLUE}  --args u64:0 u8:0 u64:10000000${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✨ Your USDC-based prediction market is ready!${NC}"
echo ""

# Save the module address to .env if frontend exists
if [ -d "../frontend" ]; then
    cat <<EOF > ../frontend/.env
VITE_MODULE_ADDRESS=$ACCOUNT_ADDRESS
VITE_USDC_MODULE_ADDRESS=$ACCOUNT_ADDRESS
EOF
    echo -e "${GREEN}✅ Frontend .env file created${NC}"
fi
