#!/bin/bash

# Test script for Sui market objects endpoint
# Usage: ./test-sui-endpoint.sh [market_id]

BACKEND_URL="http://localhost:3001"
MARKET_ID="${1:-0}"

echo "====================================="
echo "Testing Sui Market Objects Endpoint"
echo "====================================="
echo ""
echo "Backend URL: $BACKEND_URL"
echo "Market ID: $MARKET_ID"
echo ""

# Test 1: Check if backend is running
echo "[1/3] Checking if backend is running..."
if curl -s -f "$BACKEND_URL/health" > /dev/null 2>&1; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not responding"
    echo "    Start the backend with: npm run dev"
    exit 1
fi
echo ""

# Test 2: Check if endpoint exists
echo "[2/3] Testing endpoint (expecting 404 or 200)..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/markets/sui/objects/$MARKET_ID")
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)

echo "HTTP Status: $STATUS"
echo "Response Body:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

if [ "$STATUS" = "404" ]; then
    echo "✅ Endpoint exists but market not found (expected for new setup)"
    echo "   Next step: Create a market or insert test data"
elif [ "$STATUS" = "200" ]; then
    echo "✅ Endpoint working and market found!"
    echo "   Market object ID: $(echo "$BODY" | jq -r '.marketObjectId')"
    echo "   Number of shards: $(echo "$BODY" | jq -r '.shardObjectIds | length')"
elif [ "$STATUS" = "500" ]; then
    echo "❌ Server error - check backend logs"
    echo "   Common causes:"
    echo "   - Database schema not migrated"
    echo "   - Service not imported correctly"
else
    echo "⚠️  Unexpected status code"
fi
echo ""

# Test 3: Verify database schema
echo "[3/3] Checking database schema..."
echo "Run this query in your database:"
echo ""
echo "SELECT column_name, data_type "
echo "FROM information_schema.columns "
echo "WHERE table_name = 'Market' "
echo "AND column_name LIKE 'sui%';"
echo ""
echo "Expected columns:"
echo "  - suiMarketObjectId (text)"
echo "  - suiShardObjectIds (text[])"
echo "  - suiQueueObjectId (text)"
echo ""

echo "====================================="
echo "Test Complete"
echo "====================================="
echo ""
echo "If endpoint doesn't exist:"
echo "1. Add route in backend/src/routes/markets.routes.ts"
echo "2. Add controller method in backend/src/controllers/markets.controller.ts"
echo "3. Create sui-market-lookup.service.ts"
echo "4. Restart backend"
echo ""
echo "If 404 is returned:"
echo "1. Create a Sui market via the UI"
echo "2. Check Sui Explorer for object IDs"
echo "3. Insert into database (see NEXT_STEPS_SUI_INTEGRATION.md)"
