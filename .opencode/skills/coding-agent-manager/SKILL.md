---
name: coding-agent-manager
description: 管理本地 coding agent（opencode/claude-code）的启动、停止、状态查看、任务分派和交互。
---

# Coding Agent Manager

管理本地 coding agent（opencode/claude-code）的启动、停止、状态查看、任务分派和交互。

## 架构说明

**tmux 是唯一的状态来源。** 不使用任何本地持久化文件来维护 agent 状态。

- 所有 agent 进程运行在独立的 tmux session 中
- 通过 tmux session 名称匹配 agent 的工作路径
- agent 的进程号通过 tmux 查询获取
- 与 agent 的交互通过 tmux send-keys/capture-pane 实现

## 使用场景

- 启动新的 coding agent 处理独立任务
- 查看当前运行中的 agent 状态
- 停止不再需要的 agent
- 通过 task file 分派任务给指定的 agent
- 与运行中的 agent 实时交互

## CLI 命令

### coding-agent-cli start

启动一个新的 coding agent。

```bash
coding-agent-cli start <path> --type <opencode|claude-code>
```

参数：
- `path`: 工作目录路径
- `--type`: agent 类型，必须是 `opencode` 或 `claude-code`

### coding-agent-cli stop

停止正在运行的 coding agent。

```bash
coding-agent-cli stop <path>
```

参数：
- `path`: 工作目录路径

### coding-agent-cli status

查看 agent 状态。

```bash
coding-agent-cli status [path]
```

参数：
- `path` (可选): 工作目录路径，不填则查看所有

### coding-agent-cli list

列出所有运行中的 agent。

```bash
coding-agent-cli list
```

显示信息包括：
- Path: 工作目录
- Type: agent 类型
- PID: 当前进程 ID (从 tmux 获取)
- tmux: tmux session 名称
- Uptime: 运行时长

### coding-agent-cli sessions

列出 OpenCode 或 Claude Code 的历史 sessions。

```bash
coding-agent-cli sessions [path] [--type <opencode|claude-code>] [--limit N]
```

参数：
- `path` (可选): 项目路径，不填则显示所有项目
- `--type`: 工具类型，默认 `opencode`
- `--limit`: 显示数量，默认 20

### coding-agent-cli chat

与运行中的 agent 交互，发送消息并获取实时响应。

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

### coding-agent-cli task

通过 task file 分派任务给指定的 agent。

```bash
coding-agent-cli task <path> <task-file>
```

参数：
- `path`: 工作目录路径
- `task-file`: 任务文件路径 (JSON 格式)

Task file 格式：
```json
{
  "taskId": "task-001",
  "description": "任务描述",
  "requirements": ["需求1", "需求2"],
  "context": {
    "instructions": "额外上下文说明",
    "files": ["/path/to/file1", "/path/to/file2"]
  }
}
```

执行完成后会在 task file 同目录生成 `<task-file>.result.json`。

## 实现说明

### tmux 进程管理

此 skill 使用 **tmux** 管理所有 coding agent 进程：

- **持久化 session**: agent 进程在独立的 tmux session 中运行，即使父进程退出也会继续运行
- **跨终端支持**: 可以从任意终端 attach 到 agent session 查看输出
- **唯一状态来源**: 所有状态查询直接从 tmux 获取，无本地文件

tmux Session 命名规则: `code-ing-<sanitized-path>`

例如：`/Users/horizon/work/my-project` → `code-ing-Users-horizon-work-my-project`

路径解析：从 tmux session 名称反向解析出工作目录路径。

### ACP 协议交互

`chat` 命令使用 **ACP (Agent Client Protocol)** 协议与 agent 通信：

1. 通过 tmux send-keys 发送 JSON-RPC 2.0 请求
2. 通过 tmux capture-pane 捕获响应
3. 流式接收 agent 的响应

支持的 Agent 类型：
- `opencode` - 通过 `opencode acp` 命令

### Sessions 查询

`sessions` 命令直接读取工具的本地存储：

| 工具 | 存储方式 | 位置 |
|------|----------|------|
| OpenCode | SQLite | `~/.local/share/opencode/opencode.db` |
| Claude Code | JSONL | `~/.claude/history.jsonl` |

## 常用操作

```bash
# 查看 agent 输出
tmux attach -t code-ing-<sanitized-path>

# 列出所有 code-ing session
tmux list-sessions | grep code-ing

# 强制停止 session
tmux kill-session -t code-ing-<sanitized-path>
```

## 完整工作流

```bash
# 1. 启动 agent
coding-agent-cli start /path/to/project --type opencode

# 2. 查看 agent 状态
coding-agent-cli list

# 3. 发送消息交互
coding-agent-cli chat /path/to/project "帮我重构这个函数"

# 4. 查看工作进度
coding-agent-cli chat /path/to/project "你现在在做什么？"

# 5. 查看历史 sessions
coding-agent-cli sessions /path/to/project

# 6. 任务完成后停止
coding-agent-cli stop /path/to/project
```
