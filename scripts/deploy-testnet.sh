#!/bin/bash
# Deploy smart contracts to Aptos Testnet

set -e  # Exit on error

echo "🚀 Deploying to Aptos Testnet..."

# Check if in correct directory
if [ ! -f "Move.toml" ]; then
    echo "❌ Error: Must run from contracts directory"
    echo "Run: cd contracts && ../scripts/deploy-testnet.sh"
    exit 1
fi

# Check Aptos CLI is installed
if ! command -v aptos &> /dev/null; then
    echo "❌ Error: Aptos CLI not installed"
    echo "Install: curl -fsSL \"https://aptos.dev/scripts/install_cli.py\" | python3"
    exit 1
fi

echo "📦 Step 1: Compiling contracts..."
aptos move compile --named-addresses prediction_market=default

echo ""
echo "✅ Compilation successful!"
echo ""

echo "📤 Step 2: Publishing to testnet..."
aptos move publish \
    --named-addresses prediction_market=default \
    --profile testnet \
    --assume-yes

echo ""
echo "✅ Deployment complete!"
echo ""

# Get deployed address
ADDRESS=$(aptos config show-profiles --profile=testnet | grep account | awk '{print $NF}')
echo "📝 Contract deployed at: $ADDRESS"
echo ""
echo "🔗 View on Explorer:"
echo "https://explorer.aptoslabs.com/account/$ADDRESS?network=testnet"
echo ""
echo "📋 Update your .env file with:"
echo "VITE_MODULE_ADDRESS=$ADDRESS"
echo "VITE_USDC_MODULE_ADDRESS=<CIRCLE_OR_DEV_USDC_ADDRESS>"
echo ""

# Create frontend .env file
echo "🔧 Creating frontend environment file..."
cat > ../frontend/.env << EOF
# Move Market Frontend Environment Variables
VITE_MODULE_ADDRESS=$ADDRESS
VITE_USDC_MODULE_ADDRESS=$ADDRESS
VITE_NETWORK=testnet
VITE_NODE_URL=https://fullnode.testnet.aptoslabs.com
VITE_FAUCET_URL=https://faucet.testnet.aptoslabs.com
EOF

echo "✅ Frontend .env file created!"
echo ""
echo "🚀 Next steps:"
echo "1. cd ../frontend"
echo "2. npm install"
echo "3. npm run dev"
echo ""
