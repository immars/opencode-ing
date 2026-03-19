#!/bin/bash
set -e

PASS=0
FAIL=0

echo "=== coding-agent-cli Full Lifecycle Test ==="

# 清理环境
cleanup() {
    rm -rf .code-ing/agents/registry.json 2>/dev/null
    rm -rf "$TEST_DIR"
}

# 创建测试目录
TEST_DIR="/tmp/coding-agent-test-$$
mkdir -p "$TEST_DIR"

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

echo "=== Test 5: Stop(不存在) ==="
coding-agent-cli stop /nonexistent/path

if [ $? -ne 0 ]; then
    echo "Pass"
    PASS=$((PASS++))
else
    echo "Fail"
    FAIL=$((FAIL++))
fi

echo ""
echo "=== Test 6: Start - 缺少 path ==="
coding-agent-cli start
if [ $? -ne 0 ]; then
    echo "Pass"
    PASS=$((PASS++))
else
    echo "Fail"
    FAIL=$((FAIL++))
fi

echo ""
echo "=== Test 7: Start - 缺少 type ==="
coding-agent-cli start /tmp
if [ $? -ne 0 ]; then
    echo "Pass"
    PASS=$((PASS++))
else
    echo "Fail"
    FAIL=$((FAIL++))
fi

echo ""
echo "=== Test 8: Start - 无效 type ==="
coding-agent-cli start /tmp --type invalid
if [ $? -ne 0 ]; then
    echo "Pass"
    PASS=$((PASS++))
else
    echo "Fail"
    FAIL=$((FAIL++))
fi

echo ""
echo "=== Test 9: Task - 缺少参数 ==="
coding-agent-cli task
if [ $? -ne 0 ]; then
    echo "Pass"
    PASS=$((PASS++))
else
    echo "Fail"
    FAIL=$((FAIL++))
fi

echo ""
echo "=== Test 10: 未知命令 ==="
coding-agent-cli unknown
if [ $? -ne 0 ]; then
    echo "Pass"
    PASS=$((PASS++))
else
    echo "Fail"
    FAIL=$((FAIL++))
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

echo ""
echo "=== Test 7: Start - 缺少 type ==="
coding-agent-cli start /tmp
if [ $? -ne 0 ]; then
    echo "Pass"
    PASS=$((PASS++))
else
    echo "Fail"
    FAIL=$((FAIL++))
fi

echo ""
echo "=== Test 8: Start - 无效 type ==="
coding-agent-cli start /tmp --type invalid
if [ $? -ne 0 ]; then
    echo "Pass"
    PASS=$((PASS++))
else
    echo "Fail"
    FAIL=$((FAIL++))
fi
echo ""
echo "=== Test 9: Task - 缺少参数 ==="
coding-agent-cli task
if [ $? -ne 0 ]; then
    echo "Pass"
    PASS=$((PASS++))
else
    echo "Fail"
    FAIL=$((FAIL++))
fi
echo ""
echo "=== Test 10: 未知命令 ==="
coding-agent-cli unknown
if [ $? -ne 0 ]; then
    echo "Pass"
    PASS=$((PASS++))
else
    echo "Fail"
    FAIL=$((FAIL++))
fi

echo ""
echo "=== Test Results ==="
echo "PASS: $PASS"
echo "Fail: $FAIL"

echo ""
if [ $FAIL -eq 0 ]; then
    echo "Some tests failed!"
    exit 1
else
    echo "All tests passed!"
    exit 0
fi
