#!/bin/bash
set -e

PASS=0
FAIL=0

echo "=== coding-agent-cli Full Lifecycle Test ==="

# 创建测试目录
TEST_DIR="/tmp/coding-agent-test-$$"
mkdir -p "$TEST_DIR"

# 清理环境
cleanup() {
    rm -rf .code-ing/agents/registry.json 2>/dev/null
    rm -rf "$TEST_DIR"
}
trap cleanup EXIT

echo ""
echo "=== Test 1: Help ==="
coding-agent-cli --help

echo ""

echo "=== Test 2: Version ==="
coding-agent-cli --version

echo ""

echo "=== Test 3: Status (空) ==="
coding-agent-cli status

echo ""

echo "=== Test 4: List(空) ==="
coding-agent-cli list

echo ""

echo "=== Test 5: Stop(不存在) - should return error ==="
if coding-agent-cli stop /nonexistent/path 2>&1; then
    echo "Fail - should have returned error"
    FAIL=$((FAIL+1))
else
    echo "Pass - returned error as expected"
    PASS=$((PASS+1))
fi

echo ""
echo "=== Test 6: Start - 缺少 path ==="
if coding-agent-cli start 2>&1; then
    echo "Fail - should have returned error"
    FAIL=$((FAIL+1))
else
    echo "Pass - returned error as expected"
    PASS=$((PASS+1))
fi

echo ""
echo "=== Test 7: Start - 缺少 type ==="
if coding-agent-cli start /tmp 2>&1; then
    echo "Fail - should have returned error"
    FAIL=$((FAIL+1))
else
    echo "Pass - returned error as expected"
    PASS=$((PASS+1))
fi

echo ""
echo "=== Test 8: Start - 无效 type ==="
if coding-agent-cli start /tmp --type invalid 2>&1; then
    echo "Fail - should have returned error"
    FAIL=$((FAIL+1))
else
    echo "Pass - returned error as expected"
    PASS=$((PASS+1))
fi

echo ""
echo "=== Test 9: Task - 缺少参数 ==="
if coding-agent-cli task 2>&1; then
    echo "Fail - should have returned error"
    FAIL=$((FAIL+1))
else
    echo "Pass - returned error as expected"
    PASS=$((PASS+1))
fi

echo ""
echo "=== Test 10: 未知命令 ==="
if coding-agent-cli unknown 2>&1; then
    echo "Fail - should have returned error"
    FAIL=$((FAIL+1))
else
    echo "Pass - returned error as expected"
    PASS=$((PASS+1))
fi

echo ""
echo "=== Test Results ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"

if [ $FAIL -eq 0 ]; then
    echo "All tests passed!"
    exit 0
else
    echo "Some tests failed!"
    exit 1
fi
