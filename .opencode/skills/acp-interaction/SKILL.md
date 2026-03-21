---
name: acp-interaction
description: 通过 ACP 协议与运行中的 coding agent 交互，发送消息并获取实时响应
---

# ACP Interaction

通过 ACP (Agent Client Protocol) 协议与运行中的 coding agent 交互。

## 使用场景

- 向运行中的 agent 发送即时消息
- 获取 agent 的流式响应
- 查询或引导 agent 的工作进展
- 远程操控 agent 执行特定任务

## CLI 命令

### coding-agent-cli chat

向运行中的 agent 发送消息，并实时显示 agent 的响应。

```bash
coding-agent-cli chat <path> <message>
```

参数：
- `path`: agent 的工作目录路径
- `message`: 要发送的消息内容

示例：
```bash
coding-agent-cli chat /Users/horizon/work/my-project "检查一下 src/index.ts 的类型错误"
```

输出：
- 消息发送后，agent 的响应会流式输出到终端
- 结束时显示 `stopReason`（如 `end_turn`, `cancelled` 等）

## 实现说明

此 skill 使用 **ACP (Agent Client Protocol)** 协议与 agent 通信：

### ACP 协议流程

1. `initialize()` - 建立 JSON-RPC 2.0 连接
2. `sessionLoad(sessionId, cwd)` - 加载现有 agent 会话
3. `sessionPrompt(sessionId, prompt)` - 发送消息
4. 通过 `onSessionUpdate` 回调接收流式响应

### Session ID

每个 agent 启动时分配一个唯一的 `sessionId`，存储在 `.code-ing/agents/registry.json` 中。通过 `coding-agent-cli list` 或 `status` 可查看。

### 支持的 Agent 类型

- `opencode` - 通过 `opencode acp` 命令
- `claude-code` - 通过 `claude code --agent` 命令

### 响应类型

Agent 的 `sessionUpdate` 通知包括：
- `agent_message_chunk` - 流式文本响应
- `tool_call` - 工具调用开始
- `tool_call_update` - 工具调用状态更新
- `plan` - 计划更新

## 与 coding-agent-manager 配合使用

```bash
# 1. 启动 agent
coding-agent-cli start /path/to/project --type opencode

# 2. 查看 agent 状态和 session ID
coding-agent-cli list

# 3. 发送消息交互
coding-agent-cli chat /path/to/project "帮我重构这个函数"

# 4. 查看工作进度
coding-agent-cli chat /path/to/project "你现在在做什么？"

# 5. 任务完成后停止
coding-agent-cli stop /path/to/project
```

## 高级用法

### 批量任务

结合 `task` 命令使用 task file 可以发送更复杂的结构化任务：

```bash
coding-agent-cli task /path/to/project task.json
```

### 实时监控

通过 `chat` 命令可以定期查询 agent 状态：

```bash
coding-agent-cli chat /path/to/project "报告当前进度"
```
