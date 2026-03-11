#!/usr/bin/env bash
# OpenCode-ing Agent Startup Script
# Usage: bash scripts/start-agent.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/agent.yaml"

echo "=== OpenCode-ing Agent ==="

# Check config file exists
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: 配置文件不存在: $CONFIG_FILE"
  echo "请先运行 /ing-setup 或复制模板:"
  echo "  cp config/agent.yaml.example config/agent.yaml"
  exit 1
fi

# Ensure directories exist
mkdir -p "$PROJECT_ROOT/groups" "$PROJECT_ROOT/store"

echo "配置文件: $CONFIG_FILE"
echo "工作目录: $PROJECT_ROOT"
echo ""
echo "TODO: Agent 启动逻辑将在后续迭代中实现"
echo "当前为占位脚本 (Iteration 1)"
