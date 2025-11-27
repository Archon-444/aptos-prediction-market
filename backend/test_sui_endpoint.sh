#!/bin/bash
# Test the Sui Market Objects endpoint for marketId=0
URL="http://localhost:3001/api/markets/sui/objects/0"
echo "Testing endpoint $URL"
curl -s -w "\n%{http_code}" "$URL"
