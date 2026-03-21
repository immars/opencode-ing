---
name: coding-agent-manager
description: 管理本地 coding agent（opencode/claude-code）的启动、停止、状态查看和任务分派。如需与 agent 交互，使用 acp-interaction skill。
---

# Coding Agent Manager

管理本地 coding agent（opencode/claude-code）的启动、停止、状态查看和任务分派。

## 使用场景

- 启动新的 coding agent 处理独立任务
- 查看当前运行中的 agent 状态
- 停止不再需要的 agent
- 通过 task file 分派任务给指定的 agent

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

列出所有注册的 agent。

```bash
coding-agent-cli list
```

显示信息包括：
- Path: 工作目录
- Type: agent 类型
- PID: 当前进程 ID
- tmux: tmux session 名称
- Status: 运行状态 (`running` / `stopped` / `error` / `zombie`)
- Uptime: 运行时长

`zombie` 状态表示 registry 记录为 running 但 tmux session 不存在。

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

此 skill 使用 **tmux** 管理所有 coding agent 进程：

- **持久化 session**: agent 进程在独立的 tmux session 中运行，即使父进程退出也会继续运行
- **跨终端支持**: 可以从任意终端 attach 到 agent session 查看输出
- **自动状态同步**: 所有命令执行前自动以 tmux 实际状态为准，清理 registry 中的僵尸记录

### tmux Session 命名规则

所有 agent session 使用格式: `code-ing-<sanitized-path>`

例如：`/Users/horizon/work/my-project` → `code-ing-Users-horizon-work-my-project`

### 状态文件

Agent 注册信息存储在 `.code-ing/agents/registry.json`

### 常用操作

```bash
# 查看 agent 输出
tmux attach -t code-ing-<sanitized-path>

# 列出所有 code-ing session
tmux list-sessions | grep code-ing

# 强制停止 session
tmux kill-session -t code-ing-<sanitized-path>
```

## 与 agent 交互

使用 **acp-interaction** skill 通过 ACP 协议与 agent 通信：

```bash
# 发送消息给 agent
coding-agent-cli chat <path> <message>
```

详见 `.opencode/skills/acp-interaction/SKILL.md`。
