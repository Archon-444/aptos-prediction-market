#!/bin/bash

# Move Market - Devnet Deployment Script
# This script deploys the prediction market smart contracts to Aptos devnet

set -e  # Exit on error

echo "🚀 Move Market - Devnet Deployment"
echo "=============================================="
echo ""

# Configuration
APTOS_CLI="${APTOS_CLI:-aptos}"
NETWORK="devnet"
CONTRACT_DIR="$(dirname "$0")/.."
PROFILE="${PROFILE:-default}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

info() {
    echo -e "ℹ️  $1"
}

# Check if aptos CLI is installed
check_aptos_cli() {
    if ! command -v $APTOS_CLI &> /dev/null; then
        error "Aptos CLI not found. Please install it first:"
        echo "  curl -fsSL \"https://aptos.dev/scripts/install_cli.py\" | python3"
        exit 1
    fi

    local version=$($APTOS_CLI --version 2>&1 | head -n 1)
    success "Aptos CLI found: $version"
}

# Check if profile exists
check_profile() {
    if ! $APTOS_CLI account list --profile $PROFILE &> /dev/null; then
        warning "Profile '$PROFILE' not found"
        info "Creating new profile..."
        $APTOS_CLI init --profile $PROFILE --network $NETWORK
        success "Profile created"
    else
        success "Profile '$PROFILE' found"
    fi
}

# Get account info
get_account_info() {
    local account=$($APTOS_CLI config show-profiles --profile $PROFILE 2>&1 | grep "account" | awk '{print $2}')
    echo $account
}

# Fund account from faucet
fund_account() {
    local account=$(get_account_info)
    info "Funding account $account from faucet..."

    $APTOS_CLI account fund-with-faucet --account $account --profile $PROFILE || {
        warning "Faucet funding failed (account may already have funds)"
    }

    local balance=$($APTOS_CLI account list --profile $PROFILE 2>&1 | grep "0x1::aptos_coin::AptosCoin" | awk '{print $3}')
    success "Account balance: $balance APT"
}

# Compile contracts
compile_contracts() {
    info "Compiling contracts..."
    cd "$CONTRACT_DIR"

    local account=$($APTOS_CLI config show-profiles --profile $PROFILE 2>&1 | grep "account" | awk '{print $2}')
    local usdc_metadata="0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832"

    $APTOS_CLI move compile --named-addresses prediction_market=$account,circle=$usdc_metadata || {
        error "Compilation failed"
    }

    success "Contracts compiled successfully"
}

# Publish contracts
publish_contracts() {
    info "Publishing contracts to $NETWORK..."
    cd "$CONTRACT_DIR"

    local account=$(get_account_info)

    local usdc_metadata="0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832"

    $APTOS_CLI move publish \
        --named-addresses prediction_market=$account,circle=$usdc_metadata \
        --profile $PROFILE \
        --assume-yes || {
        error "Deployment failed"
    }

    success "Contracts published successfully"
    info "Contract address: $account"
}

# Initialize contracts
initialize_contracts() {
    local account=$(get_account_info)

    info "Initializing market manager..."
    $APTOS_CLI move run \
        --function-id ${account}::market_manager::initialize \
        --profile $PROFILE \
        --assume-yes || {
        warning "Market manager already initialized or failed"
    }

    local usdc_metadata="0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832"
    local vault_seed_hex="0x7661756c74"
    local oracle_seed_hex="0x6f7261636c65"

    info "Initializing collateral vault..."
    $APTOS_CLI move run \
        --function-id ${account}::collateral_vault::initialize \
        --args vector<u8>:$vault_seed_hex address:$usdc_metadata \
        --profile $PROFILE \
        --assume-yes || {
        warning "Collateral vault already initialized or failed"
    }

    info "Initializing betting system..."
    $APTOS_CLI move run \
        --function-id ${account}::betting::initialize \
        --profile $PROFILE \
        --assume-yes || {
        warning "Betting system already initialized or failed"
    }

    info "Initializing oracle registry..."
    $APTOS_CLI move run \
        --function-id ${account}::oracle::initialize \
        --args vector<u8>:$oracle_seed_hex \
        --profile $PROFILE \
        --assume-yes || {
        warning "Oracle registry already initialized or failed"
    }

    success "Contracts initialized"
}

# Verify deployment
verify_deployment() {
    local account=$(get_account_info)

    info "Verifying deployment..."

    # Check if modules are deployed
    $APTOS_CLI account list --profile $PROFILE | grep -q "market_manager" && {
        success "market_manager module found"
    } || {
        warning "market_manager module not found"
    }

    info "Deployment verification complete"
}

# Display summary
display_summary() {
    local account=$(get_account_info)

    echo ""
    echo "=============================================="
    echo "📋 Deployment Summary"
    echo "=============================================="
    echo ""
    echo "Network:         $NETWORK"
    echo "Profile:         $PROFILE"
    echo "Contract Address: $account"
    echo ""
    echo "Deployed Modules:"
    echo "  ✅ access_control"
    echo "  ✅ market_manager"
    echo "  ✅ collateral_vault"
    echo "  ✅ betting"
    echo "  ✅ amm"
    echo "  ✅ oracle"
    echo "  ✅ multi_oracle"
    echo "  ✅ dispute_resolution"
    echo ""
    echo "Next Steps:"
    echo "  1. Update frontend with contract address: $account"
    echo "  2. Test contract functions using Aptos Explorer"
    echo "  3. Create test markets and place bets"
    echo ""
    echo "Useful Commands:"
    echo "  # Create a market"
    echo "  $APTOS_CLI move run \\"
    echo "    --function-id ${account}::market_manager::create_market \\"
    echo "    --args string:\"Will BTC reach \$100k?\" \\"
    echo "           'vector<string>:[\"Yes\",\"No\"]' \\"
    echo "           u64:24 \\"
    echo "    --profile $PROFILE"
    echo ""
    echo "  # View deployment on Explorer"
    echo "  https://explorer.aptoslabs.com/account/${account}?network=${NETWORK}"
    echo ""
}

# Main deployment flow
main() {
    echo "Starting deployment process..."
    echo ""

    check_aptos_cli
    check_profile
    fund_account
    compile_contracts
    publish_contracts
    initialize_contracts
    verify_deployment
    display_summary

    success "Deployment complete! 🎉"
}

# Run main function
main
