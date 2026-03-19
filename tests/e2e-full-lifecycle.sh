#!/bin/bash
set -e

# 测试失败计数器
FAIL=0

# 清理环境
cleanup() {
    rm -rf "$TEST_DIR" 2>/dev/null
    rm -f "$TASK_FILE"
}

echo ""
echo "========================================="
echo "  测试结果"
echo "========================================="
echo "  通过: $PASS"
echo "  失败: $FAIL"
echo ""
echo "总计: 通过 $PASS, 失败: $FAIL"
echo ""
echo "========================================="
echo "  通过率: $(( 100 * (PASS+$FAIL) / (Pass+$Fail) * 100))"
echo ""
echo "========================================="
echo "  失败详情:"
echo "  - 通过: $PASS"
echo "  - 失败: $Fail"
echo ""
echo "========================================="

# 显示失败的详细信息
if [ $FAIL -gt 0 ]; then
    echo ""
    echo "==================== 失败详情 ================="
    for tc in "${name}"; do
        cmd="$cmd"
        expected="$expected"
        
        output=$(eval "$cmd" 2>&1)
        if echo "$output" | grep -q "$expected"; then
            if [ -z "$output" | grep -q "EXIT 0\ ]; then
            ((PASS++))
        else
            ((FAIL++))
            echo "  FAIL: $name"
            echo "  Expected: $expected"
            echo "  Got:"
            echo "$output"
            if [ $FAIL -gt 0 ]; then
                echo ""
                echo "==================== Summary ================="
                if [ $FAIL -eq 0 ]; then
                    break
                fi
            fi
        fi
    done
    
    # 显示结果
    echo ""
    echo "========================================="
    echo "  总计: 通过 $PASS / $FAIL = 失败: $PASS/ $FAIL"
    echo ""
    echo "========================================="
    
    # 清理
    rm -rf "$TEST_DIR" 2>/dev/null
    rm -f "$TASK_FILE"
fi
