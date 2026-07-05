#!/usr/bin/env bash
# Smoke test: reset DB, signup, login, fetch db, add a transaction via /api/db
# Requires: curl, jq
set -euo pipefail
BASE=${BASE_URL:-http://127.0.0.1:3000}
COOKIES=/tmp/kudi_cookies.txt
rm -f "$COOKIES"

echo "Resetting DB..."
curl -s -X POST "$BASE/api/db/reset" -H 'Content-Type: application/json' | jq '.' > /dev/null

EMAIL="smoke.user+$(date +%s)@example.com"
PASS='SmokePass123!'
NAME='Smoke Tester'
ROLE='buyer'

echo "Signing up $EMAIL"
curl -s -c "$COOKIES" -X POST "$BASE/api/auth/signup" -H 'Content-Type: application/json' -d \
  "{\"name\":\"$NAME\",\"email\":\"$EMAIL\",\"role\":\"$ROLE\",\"password\":\"$PASS\"}" | jq '.'

echo "Fetching session"
curl -s -b "$COOKIES" "$BASE/api/session" | jq '.'

echo "Fetching DB"
DB_JSON=$(curl -s -b "$COOKIES" "$BASE/api/db")

# create a minimal transaction and push via /api/db
TX_ID="tx_$(date +%s)"
NEW_DB=$(echo "$DB_JSON" | jq --arg id "$TX_ID" --arg email "$EMAIL" '.transactions += [{id:$id, ref:("KDE-" + ($id)), buyerId:(.users[] | select(.email==$email) | .id), sellerId:(.users[0].id), logisticsId:(.users[0].id), item:"Smoke Test Item", amount:100, currency:"USD", status:"funded", createdAt:(now|floor), stages:["Funded","Shipped","In Transit","Delivered","Released"], stageIndex:0}]')

echo "Pushing new DB with transaction $TX_ID"
curl -s -b "$COOKIES" -X POST "$BASE/api/db" -H 'Content-Type: application/json' -d "{\"db\":$(echo "$NEW_DB" | jq -c '.') }" | jq '.'

echo "Visit transaction:"
TRANSACTION_URL="$BASE/transaction.html?id=$TX_ID"
echo $TRANSACTION_URL

# fetch transaction page to ensure session still valid (should not redirect to login)
curl -s -b "$COOKIES" "$TRANSACTION_URL" | head -n 20

echo "Smoke test completed."