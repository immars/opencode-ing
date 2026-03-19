#!/bin/bash
# 快速测试 - 不等待真实 ACP 连接

PASS=0
FAIL=0

echo "=== coding-agent-cli 快速测试 ==="
echo ""

echo "=== 1. Help ==="
output=$(coding-agent-cli --help 2>&1)
if echo "$output" | grep -q "start\|stop\|status\|list\|task"; then
    echo "✅ PASS"
    PASS=$((PASS+1))
else
    echo "❌ FAIL"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=== 2. Version ==="
output=$(coding-agent-cli --version 2>&1)
if echo "$output" | grep -q "1\.0\.0"; then
    echo "✅ PASS"
    PASS=$((PASS+1))
else
    echo "❌ FAIL"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=== 3. List (空) ==="
output=$(coding-agent-cli list 2>&1)
if echo "$output" | grep -qi "no agents"; then
    echo "✅ PASS"
    PASS=$((PASS+1))
else
    echo "❌ FAIL: $output"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=== 4. Status (空) ==="
output=$(coding-agent-cli status 2>&1)
if echo "$output" | grep -qi "no agents\|agent"; then
    echo "✅ PASS"
    PASS=$((PASS+1))
else
    echo "❌ FAIL: $output"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=== 5. Stop (不存在) ==="
output=$(coding-agent-cli stop /nonexistent 2>&1)
if echo "$output" | grep -qi "no agent"; then
    echo "✅ PASS"
    PASS=$((PASS+1))
else
    echo "❌ FAIL: $output"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=== 6. Start 缺少 path ==="
output=$(coding-agent-cli start 2>&1)
if echo "$output" | grep -qi "path.*required"; then
    echo "✅ PASS"
    PASS=$((PASS+1))
else
    echo "❌ FAIL: $output"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=== 7. Start 缺少 type ==="
output=$(coding-agent-cli start /tmp 2>&1)
if echo "$output" | grep -qi "type.*required"; then
    echo "✅ PASS"
    PASS=$((PASS+1))
else
    echo "❌ FAIL: $output"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=== 8. Start 无效 type ==="
output=$(coding-agent-cli start /tmp --type invalid 2>&1)
if echo "$output" | grep -qi "invalid type"; then
    echo "✅ PASS"
    PASS=$((PASS+1))
else
    echo "❌ FAIL: $output"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=== 9. Task 缺少参数 ==="
output=$(coding-agent-cli task 2>&1)
if echo "$output" | grep -qi "path.*required\|Usage"; then
    echo "✅ PASS"
    PASS=$((PASS+1))
else
    echo "❌ FAIL: $output"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=== 10. 未知命令 ==="
output=$(coding-agent-cli unknown 2>&1)
if echo "$output" | grep -qi "unknown"; then
    echo "✅ PASS"
    PASS=$((PASS+1))
else
    echo "❌ FAIL: $output"
    FAIL=$((FAIL+1))
fi

echo ""
echo "========================================"
echo "  Results: PASS=$PASS FAIL=$FAIL"
echo "========================================"

if [ $FAIL -eq 0 ]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ Some tests failed"
    exit 1
fi
