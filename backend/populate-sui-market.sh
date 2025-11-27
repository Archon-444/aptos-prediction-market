#!/bin/bash

# Script to populate Sui market object IDs in the database
# Usage: ./populate-sui-market.sh

echo "============================================"
echo "Sui Market Object ID Population Helper"
echo "============================================"
echo ""

# Get market ID
echo "First, let's find your Sui markets:"
echo ""
/opt/homebrew/opt/postgresql@15/bin/psql -U philippeschmitt -d prediction_market -c "SELECT id, \"onChainId\", question, \"createdAt\" FROM \"Market\" WHERE chain = 'sui' ORDER BY \"createdAt\" DESC LIMIT 5;"
echo ""

read -p "Enter the onChainId of the market to update: " MARKET_ID

echo ""
echo "Now, enter the Sui object IDs from your transaction:"
echo "(You can find these on Sui Explorer by searching your transaction digest)"
echo ""

read -p "Market Object ID (0x...): " MARKET_OBJECT_ID
read -p "Queue Object ID (0x...): " QUEUE_OBJECT_ID

echo ""
echo "How many shard objects does your market have? (typically 4)"
read -p "Number of shards: " NUM_SHARDS

SHARD_IDS=""
for i in $(seq 1 $NUM_SHARDS); do
    read -p "Shard $i Object ID (0x...): " SHARD_ID
    if [ $i -eq 1 ]; then
        SHARD_IDS="'$SHARD_ID'"
    else
        SHARD_IDS="$SHARD_IDS,'$SHARD_ID'"
    fi
done

echo ""
echo "============================================"
echo "Confirmation"
echo "============================================"
echo "Market onChainId: $MARKET_ID"
echo "Market Object: $MARKET_OBJECT_ID"
echo "Queue Object: $QUEUE_OBJECT_ID"
echo "Shard Objects: $SHARD_IDS"
echo ""

read -p "Does this look correct? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted. Please run the script again."
    exit 1
fi

echo ""
echo "Updating database..."
echo ""

SQL="UPDATE \"Market\"
SET \"suiMarketObjectId\" = '$MARKET_OBJECT_ID',
    \"suiShardObjectIds\" = ARRAY[$SHARD_IDS],
    \"suiQueueObjectId\" = '$QUEUE_OBJECT_ID'
WHERE \"onChainId\" = '$MARKET_ID' AND \"chain\" = 'sui';"

/opt/homebrew/opt/postgresql@15/bin/psql -U philippeschmitt -d prediction_market -c "$SQL"

echo ""
echo "Verifying update..."
echo ""

/opt/homebrew/opt/postgresql@15/bin/psql -U philippeschmitt -d prediction_market -c "SELECT \"onChainId\", \"suiMarketObjectId\", \"suiShardObjectIds\", \"suiQueueObjectId\" FROM \"Market\" WHERE \"onChainId\" = '$MARKET_ID' AND chain = 'sui';"

echo ""
echo "Testing API endpoint..."
curl -s "http://localhost:3001/api/markets/sui/objects/$MARKET_ID" | jq .

echo ""
echo "============================================"
echo "Done!"
echo "============================================"
echo ""
echo "Your market is now wired up and ready for betting!"
echo "Go to http://localhost:5173 and try placing a bet."
echo ""
