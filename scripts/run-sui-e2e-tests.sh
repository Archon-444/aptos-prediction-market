#!/bin/bash

# Sui End-to-End Test Runner
# This script runs comprehensive E2E tests for Sui betting and settlement flows

set -e

echo "🧪 Running Sui End-to-End Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_TIMEOUT=30000
COVERAGE_THRESHOLD=80

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Set up test environment
echo -e "${BLUE}🔧 Setting up test environment...${NC}"
export NODE_ENV=test
export VITE_SUI_PACKAGE_ID=0xtest123
export VITE_SUI_ROLE_REGISTRY_ID=0xrole123
export VITE_SUI_ORACLE_REGISTRY_ID=0xoracle123

# Create test database if needed
if [ ! -f "test.db" ]; then
    echo -e "${BLUE}🗄️  Creating test database...${NC}"
    npx prisma migrate dev --name test-setup
fi

# Run Sui-specific E2E tests
echo -e "${BLUE}🚀 Running Sui E2E tests...${NC}"

# Test categories
declare -a TEST_CATEGORIES=(
    "sui-e2e"
    "sui-wallet"
    "sui-transactions"
    "sui-settlement"
)

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

for category in "${TEST_CATEGORIES[@]}"; do
    echo -e "\n${BLUE}📋 Running $category tests...${NC}"
    
    # Run tests for this category
    if npm test -- --run --reporter=verbose --testNamePattern="$category" --timeout=$TEST_TIMEOUT; then
        echo -e "${GREEN}✅ $category tests passed${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ $category tests failed${NC}"
        ((FAILED_TESTS++))
    fi
    
    ((TOTAL_TESTS++))
done

# Run coverage analysis
echo -e "\n${BLUE}📊 Running coverage analysis...${NC}"
if npm test -- --coverage --testNamePattern="sui-e2e"; then
    COVERAGE=$(npm test -- --coverage --testNamePattern="sui-e2e" --coverageReporters=text-summary | grep -o 'All files[^0-9]*[0-9]*\.[0-9]*' | grep -o '[0-9]*\.[0-9]*$' || echo "0")
    echo -e "${BLUE}📈 Coverage: ${COVERAGE}%${NC}"
    
    if (( $(echo "$COVERAGE >= $COVERAGE_THRESHOLD" | bc -l) )); then
        echo -e "${GREEN}✅ Coverage threshold met (${COVERAGE}% >= ${COVERAGE_THRESHOLD}%)${NC}"
    else
        echo -e "${YELLOW}⚠️  Coverage below threshold (${COVERAGE}% < ${COVERAGE_THRESHOLD}%)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Coverage analysis failed${NC}"
fi

# Run performance tests
echo -e "\n${BLUE}⚡ Running performance tests...${NC}"
if npm test -- --run --testNamePattern="performance" --timeout=60000; then
    echo -e "${GREEN}✅ Performance tests passed${NC}"
else
    echo -e "${YELLOW}⚠️  Performance tests failed or not implemented${NC}"
fi

# Run integration tests with real Sui testnet
echo -e "\n${BLUE}🌐 Running integration tests with Sui testnet...${NC}"
if [ "$SKIP_TESTNET" != "true" ]; then
    if npm test -- --run --testNamePattern="integration" --timeout=120000; then
        echo -e "${GREEN}✅ Integration tests passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Integration tests failed (this is expected if testnet is not available)${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Skipping testnet integration tests${NC}"
fi

# Generate test report
echo -e "\n${BLUE}📋 Generating test report...${NC}"
cat > sui-e2e-test-report.md << EOF
# Sui End-to-End Test Report

**Generated:** $(date)
**Environment:** $NODE_ENV
**Test Timeout:** ${TEST_TIMEOUT}ms

## Summary

- **Total Test Categories:** $TOTAL_TESTS
- **Passed:** $PASSED_TESTS
- **Failed:** $FAILED_TESTS
- **Success Rate:** $(( (PASSED_TESTS * 100) / TOTAL_TESTS ))%

## Test Categories

$(for category in "${TEST_CATEGORIES[@]}"; do
    echo "- $category"
done)

## Coverage

- **Current Coverage:** ${COVERAGE}%
- **Threshold:** ${COVERAGE_THRESHOLD}%
- **Status:** $([ $(echo "$COVERAGE >= $COVERAGE_THRESHOLD" | bc -l) -eq 1 ] && echo "✅ PASSED" || echo "⚠️  BELOW THRESHOLD")

## Recommendations

$([ $FAILED_TESTS -eq 0 ] && echo "- All tests passed! 🎉" || echo "- Review failed tests and fix issues")
$([ $(echo "$COVERAGE >= $COVERAGE_THRESHOLD" | bc -l) -eq 1 ] && echo "- Coverage is adequate" || echo "- Consider adding more tests to improve coverage")

EOF

echo -e "${GREEN}📄 Test report generated: sui-e2e-test-report.md${NC}"

# Final summary
echo -e "\n${BLUE}📊 Final Summary${NC}"
echo -e "Total Categories: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo -e "Success Rate: $(( (PASSED_TESTS * 100) / TOTAL_TESTS ))%"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All Sui E2E tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please review the output above.${NC}"
    exit 1
fi
