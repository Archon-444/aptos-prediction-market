#!/bin/bash
# Sui Testnet Deployment Script
#
# This script deploys the prediction market smart contracts to Sui testnet
#
# Prerequisites:
# 1. Sui CLI installed (v1.58.2+)
# 2. Testnet account funded with SUI tokens
# 3. All contracts compiled successfully

set -e

echo "🚀 Sui Prediction Market - Testnet Deployment"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NETWORK="testnet"
CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_FILE="$CONTRACTS_DIR/deployment-${NETWORK}.json"

echo "📁 Working directory: $CONTRACTS_DIR"
echo "🌐 Network: $NETWORK"
echo ""

# Check Sui CLI
echo "🔍 Checking Sui CLI..."
if ! command -v sui &> /dev/null; then
    echo -e "${RED}❌ Sui CLI not found. Please install it first.${NC}"
    echo "   Install: cargo install --locked --git https://github.com/MystenLabs/sui.git sui"
    exit 1
fi

SUI_VERSION=$(sui --version)
echo -e "${GREEN}✅ Sui CLI found: $SUI_VERSION${NC}"
echo ""

# Check active environment
echo "🔍 Checking Sui environment..."
ACTIVE_ENV=$(sui client active-env 2>&1 | grep -v "warning" || echo "")
if [ "$ACTIVE_ENV" != "$NETWORK" ]; then
    echo -e "${YELLOW}⚠️  Active environment is '$ACTIVE_ENV', switching to '$NETWORK'...${NC}"
    sui client switch --env $NETWORK || {
        echo -e "${RED}❌ Failed to switch to $NETWORK${NC}"
        echo "   Available environments:"
        sui client envs
        exit 1
    }
fi
echo -e "${GREEN}✅ Environment: $NETWORK${NC}"
echo ""

# Check active address
echo "🔍 Checking deployment address..."
DEPLOYER_ADDRESS=$(sui client active-address 2>&1 | grep "0x" || echo "")
if [ -z "$DEPLOYER_ADDRESS" ]; then
    echo -e "${RED}❌ No active address found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Deployer address: $DEPLOYER_ADDRESS${NC}"
echo ""

# Check gas balance
echo "🔍 Checking gas balance..."
GAS_OUTPUT=$(sui client gas 2>&1 | grep -v "warning")
if echo "$GAS_OUTPUT" | grep -q "No gas coins"; then
    echo -e "${RED}❌ No gas coins found!${NC}"
    echo ""
    echo "Please fund your address with testnet SUI tokens:"
    echo "  1. Visit: https://faucet.sui.io/?address=$DEPLOYER_ADDRESS"
    echo "  2. Or use: sui client faucet"
    echo ""
    echo "Then run this script again."
    exit 1
fi
echo -e "${GREEN}✅ Gas coins available${NC}"
echo "$GAS_OUTPUT" | head -5
echo ""

# Build contracts
echo "🔨 Building Move contracts..."
cd "$CONTRACTS_DIR"
if ! sui move build 2>&1 | grep -q "BUILDING"; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Deploy contracts
echo "🚀 Deploying to $NETWORK..."
echo ""

DEPLOY_OUTPUT=$(sui client publish --gas-budget 500000000 --skip-dependency-verification 2>&1)
DEPLOY_STATUS=$?

if [ $DEPLOY_STATUS -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed!${NC}"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo "$DEPLOY_OUTPUT"
echo ""

# Parse deployment output
PACKAGE_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP 'packageId.*:\s*\K0x[a-f0-9]+' | head -1 || echo "")
if [ -z "$PACKAGE_ID" ]; then
    # Try alternative parsing
    PACKAGE_ID=$(echo "$DEPLOY_OUTPUT" | grep "Published Objects" -A 20 | grep -oP '0x[a-f0-9]{64}' | head -1 || echo "")
fi

if [ -z "$PACKAGE_ID" ]; then
    echo -e "${YELLOW}⚠️  Could not auto-parse package ID${NC}"
    echo "Please extract it manually from the output above."
    echo ""
else
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "📦 Package ID: $PACKAGE_ID"
    echo ""

    # Save deployment info
    cat > "$DEPLOYMENT_FILE" << EOF
{
  "network": "$NETWORK",
  "deployer": "$DEPLOYER_ADDRESS",
  "packageId": "$PACKAGE_ID",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "suiVersion": "$SUI_VERSION",
  "modules": [
    "market_manager",
    "market_manager_v2",
    "oracle_validator",
    "access_control"
  ]
}
EOF

    echo -e "${GREEN}✅ Deployment info saved to: $DEPLOYMENT_FILE${NC}"
    echo ""
fi

# Next steps
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Verify deployment:"
echo "   sui client object $PACKAGE_ID"
echo ""
echo "2. Initialize the contracts (if needed):"
echo "   # Create first market, set up oracle registry, etc."
echo ""
echo "3. Update your backend .env file:"
echo "   SUI_PACKAGE_ID=$PACKAGE_ID"
echo "   SUI_RPC_URL=https://fullnode.testnet.sui.io:443"
echo ""
echo "4. Test the deployment:"
echo "   # Create a test market"
echo "   # Place test bets"
echo "   # Verify oracle integration"
echo ""
echo "🎉 Deployment complete!"
