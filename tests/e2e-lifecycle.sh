#!/bin/bash
set -e

echo "========================================"
echo "  coding-agent-cli E2E Test"
echo "========================================"
echo ""

PASS=0
FAIL=0

TEST_DIR="/tmp/coding-agent-e2e-test-$$
TASK_FILE="/tmp/coding-agent-task-$$

cleanup() {
    echo ""
    echo "=== Cleanup ==="
    coding-agent-cli stop "$TEST_DIR" 2>/dev/null || true
    rm -rf "$TEST_DIR"
    rm -f "$TASK_FILE"
    rm -rf .code-ing/agents/registry.json 2>/dev/null || true
}

trap cleanup EXIT

mkdir -p "$TEST_DIR"

echo "=== E2E-01: Start Agent ==="
echo "Test Dir: $TEST_DIR"
echo ""

output=$(coding-agent-cli start "$TEST_DIR" --type opencode 2>&1)
exit_code=$?

echo "$output"
echo ""

if echo "$output" | grep -qiE "started|sessionId|PID"; then
    echo "✅ PASS: Agent started successfully"
    PASS=$((PASS++))
else
    echo "❌ FAIL: Agent did not start"
    echo "   Output: $output"
    FAIL=$((FAIL++))
    exit 1
fi

echo ""
echo "=== E2E-02: Check Status After Start ==="
output=$(coding-agent-cli status "$TEST_DIR" 2>&1)
echo "$output"
echo ""

if echo "$output" | grep -qiE "running|opencode|$TEST_DIR"; then
    echo "✅ PASS: Status shows running"
    PASS=$((PASS++))
else
    echo "❌ FAIL: Status does not show running"
    FAIL=$((FAIL++))
fi

echo ""
echo "=== E2E-03: List Agents ==="
output=$(coding-agent-cli list 2>&1)
echo "$output"
echo ""

if echo "$output" | grep -q "$TEST_DIR"; then
    echo "✅ PASS: Agent appears in list"
    PASS=$((PASS++))
else
    echo "❌ FAIL: Agent not in list"
    FAIL=$((FAIL++))
fi

echo ""
echo "=== E2E-04: Duplicate Start Should Fail ==="
output=$(coding-agent-cli start "$TEST_DIR" --type opencode 2>&1)
echo "$output"
echo ""

if echo "$output" | grep -qiE "already running"; then
    echo "✅ PASS: Duplicate start correctly rejected"
    PASS=$((PASS++))
else
    echo "❌ FAIL: Duplicate start not rejected"
    FAIL=$((FAIL++))
fi

echo ""
echo "=== E2E-05: Create Task File ==="
cat > "$TASK_FILE" << 'EOF'
{
  "taskId": "e2e-test-001",
  "description": "创建一个 hello.txt 文件",
  "requirements": [
    "文件内容为 'Hello from coding-agent!'",
    "文件保存在项目根目录"
  ],
  "context": {
    "instructions": "这是一个端到端测试任务"
  }
}
EOF

if [ -f "$TASK_FILE" ]; then
    echo "✅ PASS: Task file created"
    echo "   File: $TASK_FILE"
    cat "$TASK_FILE"
    PASS=$((PASS++))
else
    echo "❌ FAIL: Task file not created"
    FAIL=$((FAIL++))
fi

echo ""
echo "=== E2E-06: Assign Task to Agent ==="
echo "Note: This test requires a running agent with ACP support"
echo ""

output=$(coding-agent-cli task "$TEST_DIR" "$TASK_FILE" 2>&1)
exit_code=$?
echo "$output"
echo ""

if [ $exit_code -eq 0 ]; then
    echo "✅ PASS: Task assignment succeeded"
    PASS=$((PASS++))
else
    if echo "$output" | grep -qiE "No agent running"; then
        echo "⚠️  SKIP: No agent running (expected if opencode acp not available)"
    else
        echo "❌ FAIL: Task assignment failed"
        echo "   Output: $output"
        FAIL=$((FAIL++))
    fi
fi

echo ""
echo "=== E2E-07: Stop Agent ==="
output=$(coding-agent-cli stop "$TEST_DIR" 2>&1)
echo "$output"
echo ""

if echo "$output" | grep -qiE "stopped|success"; then
    echo "✅ PASS: Agent stopped successfully"
    PASS=$((PASS++))
else
    echo "❌ FAIL: Agent did not stop"
    echo "   Output: $output"
    FAIL=$((FAIL++))
fi

echo ""
echo "=== E2E-08: Check Status After Stop ==="
output=$(coding-agent-cli status "$TEST_DIR" 2>&1)
echo "$output"
echo ""

if echo "$output" | grep -qiE "no agent|stopped|not found"; then
    echo "✅ PASS: Status shows no agent after stop"
    PASS=$((PASS++))
else
    echo "❌ FAIL: Status still shows agent"
    FAIL=$((FAIL++))
fi

echo ""
echo "=== E2E-09: List After Stop ==="
output=$(coding-agent-cli list 2>&1)
echo "$output"
echo ""

if echo "$output" | grep -qiE "no agents|empty"; then
    echo "✅ PASS: List shows no agents after stop"
    PASS=$((PASS++))
else
    if ! echo "$output" | grep -q "$TEST_DIR"; then
        echo "✅ PASS: Stopped agent not in list"
        PASS=$((PASS++))
    else
        echo "❌ FAIL: Stopped agent still in list"
        FAIL=$((FAIL++))
    fi
fi

echo ""
echo "=== E2E-10: Stop Non-existent Agent ==="
output=$(coding-agent-cli stop "$TEST_DIR" 2>&1)
echo "$output"
echo ""

if echo "$output" | grep -qiE "no agent|not running"; then
    echo "✅ PASS: Stop non-existent agent handled correctly"
    PASS=$((PASS++))
else
    echo "❌ FAIL: Stop non-existent agent not handled"
    FAIL=$((FAIL++))
fi

echo ""
echo "========================================"
echo "  Test Results"
echo "========================================"
echo ""
echo "✅ PASS: $PASS"
echo "❌ FAIL: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "🎉 All tests passed!"
    exit 0
else
    echo "⚠️  Some tests failed"
    exit 1
fi
