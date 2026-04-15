#!/bin/bash
# Test script for drilldown API endpoint

API_BASE="http://localhost:3005/api"

echo "=== Testing Drilldown API ==="
echo ""

# Test 1: Basic query for AAPL
echo "1. Testing GET /api/drilldown/AAPL"
curl -s "$API_BASE/drilldown/AAPL?limit=5" | jq '.'
echo ""

# Test 2: Query with quarter filter
echo "2. Testing GET /api/drilldown/AAPL?quarter=2024Q3"
curl -s "$API_BASE/drilldown/AAPL?quarter=2024Q3&limit=5" | jq '.'
echo ""

# Test 3: Query with action filter
echo "3. Testing GET /api/drilldown/AAPL?quarter=2024Q3&action=open"
curl -s "$API_BASE/drilldown/AAPL?quarter=2024Q3&action=open&limit=5" | jq '.'
echo ""

# Test 4: Summary endpoint
echo "4. Testing GET /api/drilldown/AAPL/summary"
curl -s "$API_BASE/drilldown/AAPL/summary" | jq '.'
echo ""

# Test 5: Non-existent ticker
echo "5. Testing GET /api/drilldown/INVALID_TICKER (should return 404)"
curl -s "$API_BASE/drilldown/INVALID_TICKER" | jq '.'
echo ""

echo "=== Tests Complete ==="
