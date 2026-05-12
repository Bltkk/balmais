#!/bin/bash

# API Testing Script
# Prueba todos los endpoints de la API v1

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
BASE_URL="${BASE_URL:-http://localhost:3000/api/v1}"
API_KEY="${API_KEY:-balmais-api-key-2025-secure}"
INVALID_KEY="invalid-key-12345"

# Contadores
TESTS_PASSED=0
TESTS_FAILED=0

# Función para imprimir resultados
print_test() {
  local name=$1
  local status=$2
  local message=$3

  if [ "$status" = "PASS" ]; then
    echo -e "${GREEN}✓${NC} $name"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $name"
    echo -e "  ${RED}Error: $message${NC}"
    ((TESTS_FAILED++))
  fi
}

# Función para hacer requests
make_request() {
  local method=$1
  local endpoint=$2
  local data=$3
  local key=$4

  if [ -z "$key" ]; then
    key=$API_KEY
  fi

  if [ "$method" = "GET" ]; then
    curl -s -X GET \
      -H "Authorization: Bearer $key" \
      "$BASE_URL$endpoint"
  else
    curl -s -X POST \
      -H "Authorization: Bearer $key" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BASE_URL$endpoint"
  fi
}

echo -e "${BLUE}=== API v1 Security Tests ===${NC}\n"

# ─── Health Check ───────────────────────────────────────────────────
echo -e "${YELLOW}1. Health Check${NC}"
response=$(curl -s "$BASE_URL/health")
if echo "$response" | grep -q '"status":"ok"'; then
  print_test "Health check" "PASS"
else
  print_test "Health check" "FAIL" "Unexpected response: $response"
fi

# ─── Authentication Tests ───────────────────────────────────────────
echo -e "\n${YELLOW}2. Authentication Tests${NC}"

# Sin API key
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/products")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "401" ]; then
  print_test "Reject request without API key" "PASS"
else
  print_test "Reject request without API key" "FAIL" "Got HTTP $http_code"
fi

# Con API key inválida
response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $INVALID_KEY" \
  "$BASE_URL/products")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "401" ]; then
  print_test "Reject invalid API key" "PASS"
else
  print_test "Reject invalid API key" "FAIL" "Got HTTP $http_code"
fi

# Con API key válida
response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/products")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "200" ]; then
  print_test "Accept valid API key" "PASS"
else
  print_test "Accept valid API key" "FAIL" "Got HTTP $http_code"
fi

# ─── Input Validation Tests ─────────────────────────────────────────
echo -e "\n${YELLOW}3. Input Validation Tests${NC}"

# Limit parameter validation
response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/products?limit=1000")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)
if [ "$http_code" = "200" ] && echo "$body" | grep -q '"limit":'; then
  limit=$(echo "$body" | grep -o '"limit":[0-9]*' | cut -d: -f2)
  if [ "$limit" -le 500 ]; then
    print_test "Limit parameter capped at 500" "PASS"
  else
    print_test "Limit parameter capped at 500" "FAIL" "Got limit: $limit"
  fi
else
  print_test "Limit parameter capped at 500" "FAIL" "HTTP $http_code"
fi

# Negative quantity validation
response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"variantId":"test","quantity":-5,"type":"in"}' \
  "$BASE_URL/stock")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "400" ]; then
  print_test "Reject negative quantity" "PASS"
else
  print_test "Reject negative quantity" "FAIL" "Got HTTP $http_code"
fi

# Invalid type validation
response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"variantId":"test","quantity":5,"type":"invalid"}' \
  "$BASE_URL/stock")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "400" ]; then
  print_test "Reject invalid type" "PASS"
else
  print_test "Reject invalid type" "FAIL" "Got HTTP $http_code"
fi

# Missing required fields
response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"quantity":5}' \
  "$BASE_URL/stock")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "400" ]; then
  print_test "Reject missing required fields" "PASS"
else
  print_test "Reject missing required fields" "FAIL" "Got HTTP $http_code"
fi

# ─── SQL Injection Prevention ────────────────────────────────────────
echo -e "\n${YELLOW}4. SQL Injection Prevention${NC}"

# Test SQL injection in search
response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/products?search='; DROP TABLE products; --")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "200" ]; then
  print_test "SQL injection in search parameter" "PASS"
else
  print_test "SQL injection in search parameter" "FAIL" "Got HTTP $http_code"
fi

# ─── Rate Limiting ──────────────────────────────────────────────────
echo -e "\n${YELLOW}5. Rate Limiting (Simulation)${NC}"

# Hacer 5 requests rápidos
success_count=0
for i in {1..5}; do
  response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $API_KEY" \
    "$BASE_URL/products?limit=1")
  http_code=$(echo "$response" | tail -n1)
  if [ "$http_code" = "200" ]; then
    ((success_count++))
  fi
done

if [ "$success_count" -eq 5 ]; then
  print_test "Handle multiple rapid requests" "PASS"
else
  print_test "Handle multiple rapid requests" "FAIL" "Only $success_count/5 succeeded"
fi

# ─── Response Security ──────────────────────────────────────────────
echo -e "\n${YELLOW}6. Response Security${NC}"

# Verificar que no expone información sensible
response=$(curl -s \
  -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/products/invalid-uuid")

if ! echo "$response" | grep -qi "password\|secret\|token"; then
  print_test "No sensitive data in error responses" "PASS"
else
  print_test "No sensitive data in error responses" "FAIL" "Found sensitive data"
fi

# ─── Resumen ────────────────────────────────────────────────────────
echo -e "\n${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}All tests passed! ✓${NC}"
  exit 0
else
  echo -e "\n${RED}Some tests failed! ✗${NC}"
  exit 1
fi
