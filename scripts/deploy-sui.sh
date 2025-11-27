#!/bin/bash

# Sui Deployment Script for Prediction Market
# This script deploys the Sui Move contracts to testnet/mainnet

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NETWORK=${1:-testnet}  # Default to testnet
GAS_BUDGET=${2:-100000000}  # 0.1 SUI

echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}Sui Prediction Market Deployment Script${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""

# Check if Sui CLI is installed
if ! command -v sui &> /dev/null; then
    echo -e "${RED}Error: Sui CLI not found${NC}"
    echo "Please install Sui CLI:"
    echo "  brew install sui"
    echo "  OR"
    echo "  cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui"
    exit 1
fi

echo -e "${GREEN}✓${NC} Sui CLI found: $(sui --version)"
echo ""

# Check if we're in the right directory
if [ ! -f "contracts-sui/Move.toml" ]; then
    echo -e "${RED}Error: contracts-sui/Move.toml not found${NC}"
    echo "Please run this script from the project root"
    exit 1
fi

# Navigate to contracts directory
cd contracts-sui

echo -e "${YELLOW}Step 1: Building contracts...${NC}"
sui move build

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Build successful"
echo ""

# Get active address
ACTIVE_ADDRESS=$(sui client active-address 2>/dev/null)

if [ -z "$ACTIVE_ADDRESS" ]; then
    echo -e "${RED}Error: No active Sui address found${NC}"
    echo "Please create an address first:"
    echo "  sui client new-address ed25519 prediction-market"
    exit 1
fi

echo -e "${GREEN}Active address:${NC} $ACTIVE_ADDRESS"

# Check balance
BALANCE=$(sui client gas --json 2>/dev/null | jq -r '.[0].balance' 2>/dev/null || echo "0")

if [ "$BALANCE" -lt "$GAS_BUDGET" ]; then
    echo -e "${YELLOW}Warning: Low balance (${BALANCE} MIST)${NC}"

    if [ "$NETWORK" == "testnet" ]; then
        echo -e "${YELLOW}Requesting testnet tokens from faucet...${NC}"
        sui client faucet
        sleep 5
    else
        echo -e "${RED}Error: Insufficient balance for deployment${NC}"
        echo "Please fund your account with at least $((GAS_BUDGET / 1000000000)) SUI"
        exit 1
    fi
fi

echo ""
echo -e "${YELLOW}Step 2: Running tests...${NC}"
sui move test

if [ $? -ne 0 ]; then
    echo -e "${RED}Tests failed!${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Tests passed"
echo ""

echo -e "${YELLOW}Step 3: Publishing contracts to $NETWORK...${NC}"
echo -e "${YELLOW}Gas budget: $GAS_BUDGET MIST ($((GAS_BUDGET / 1000000000)) SUI)${NC}"
echo ""

# Publish the package
PUBLISH_OUTPUT=$(sui client publish --gas-budget $GAS_BUDGET --json)

if [ $? -ne 0 ]; then
    echo -e "${RED}Deployment failed!${NC}"
    exit 1
fi

# Parse package ID from output
PACKAGE_ID=$(echo $PUBLISH_OUTPUT | jq -r '.objectChanges[] | select(.type == "published") | .packageId')

if [ -z "$PACKAGE_ID" ]; then
    echo -e "${RED}Error: Could not extract package ID${NC}"
    echo "Raw output:"
    echo $PUBLISH_OUTPUT
    exit 1
fi

echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}✓ Deployment Successful!${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""
echo -e "${GREEN}Package ID:${NC} $PACKAGE_ID"
echo ""

# Extract capability objects
ADMIN_CAP=$(echo $PUBLISH_OUTPUT | jq -r '.objectChanges[] | select(.objectType | contains("AdminCap")) | .objectId' | head -1)
RESOLVER_CAP=$(echo $PUBLISH_OUTPUT | jq -r '.objectChanges[] | select(.objectType | contains("ResolverCap")) | .objectId' | head -1)
ROLE_REGISTRY=$(echo $PUBLISH_OUTPUT | jq -r '.objectChanges[] | select(.objectType | contains("RoleRegistry")) | .objectId' | head -1)

echo -e "${GREEN}Objects created:${NC}"
echo "  Admin Cap:     $ADMIN_CAP"
echo "  Resolver Cap:  $RESOLVER_CAP"
echo "  Role Registry: $ROLE_REGISTRY"
echo ""

# Create .env entries
echo -e "${YELLOW}Environment variables to add to backend/.env:${NC}"
echo ""
echo "SUI_PACKAGE_ID=$PACKAGE_ID"
echo "SUI_ADMIN_CAP_ID=$ADMIN_CAP"
echo "SUI_RESOLVER_CAP_ID=$RESOLVER_CAP"
echo "SUI_ROLE_REGISTRY_ID=$ROLE_REGISTRY"
echo ""

echo -e "${YELLOW}Environment variables to add to dapp/.env:${NC}"
echo ""
echo "VITE_SUI_PACKAGE_ID=$PACKAGE_ID"
echo "VITE_SUI_NETWORK=$NETWORK"
echo ""

# Save to file
cat > ../DEPLOYMENT_SUI_${NETWORK}.txt << EOF
Sui Prediction Market Deployment
Network: $NETWORK
Date: $(date)
Deployer: $ACTIVE_ADDRESS

Package ID: $PACKAGE_ID
Admin Cap: $ADMIN_CAP
Resolver Cap: $RESOLVER_CAP
Role Registry: $ROLE_REGISTRY

Explorer URL:
https://suiexplorer.com/object/$PACKAGE_ID?network=$NETWORK

Backend .env:
SUI_PACKAGE_ID=$PACKAGE_ID
SUI_ADMIN_CAP_ID=$ADMIN_CAP
SUI_RESOLVER_CAP_ID=$RESOLVER_CAP
SUI_ROLE_REGISTRY_ID=$ROLE_REGISTRY

Frontend .env:
VITE_SUI_PACKAGE_ID=$PACKAGE_ID
VITE_SUI_NETWORK=$NETWORK
EOF

echo -e "${GREEN}✓ Deployment info saved to:${NC} DEPLOYMENT_SUI_${NETWORK}.txt"
echo ""

# Export private key reminder
echo -e "${YELLOW}⚠️  Important: Export your private key for backend operations${NC}"
echo ""
echo "Run this command to export your private key:"
echo "  sui keytool export --key-identity <your-key-alias>"
echo ""
echo "Add the exported key to backend/.env:"
echo "  SUI_ADMIN_PRIVATE_KEY=<base64-encoded-key>"
echo ""

echo -e "${GREEN}✓ Deployment complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update backend/.env with the environment variables above"
echo "2. Update dapp/.env with the frontend variables"
echo "3. Export and save your private key"
echo "4. Restart your backend: cd backend && npm run dev"
echo "5. Test market creation via API"
echo ""
echo "View on explorer:"
echo "https://suiexplorer.com/object/$PACKAGE_ID?network=$NETWORK"
echo ""
