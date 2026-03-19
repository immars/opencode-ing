---
name: coding-agent-manager
description: 管理本地 coding agent（opencode/claude-code）的启动、停止、状态查看和任务分派
---

# Coding Agent Manager

管理本地 coding agent（opencode/claude-code）的启动、停止、状态查看和任务分派。

## 使用场景

- 启动新的 coding agent 处理独立任务
- 查看当前运行中的 agent 状态
- 停止不再需要的 agent
- 分派任务给指定的 agent

## 工具

### coding-agent.start

启动一个新的 coding agent。

参数：
- `path`: string - 工作目录路径
- `type`: 'opencode' | 'claude-code' - agent 类型

示例：
```
/coding-agent.start path="/path/to/project" type="opencode"
```

### coding-agent.stop

停止正在运行的 coding agent。

参数：
- `path`: string - 工作目录路径

示例：
```
/coding-agent.stop path="/path/to/project"
```

### coding-agent.status

查看 agent 状态。

参数：
- `path?`: string (optional) - 工作目录路径，不填则查看所有

示例：
```
/coding-agent.status
/coding-agent.status path="/path/to/project"
```

### coding-agent.list

列出所有注册的 agent。

无需参数。

示例：
```
/coding-agent.list
```

### coding-agent.assign-task

分派任务给指定的 agent。

参数：
- `path`: string - 工作目录路径
- `task`: string - 任务描述

示例：
```
/coding-agent.assign-task path="/path/to/project" task="修复登录页面的样式问题"
```

## 实现说明

此 skill 依赖系统中的 coding agent 管理工具，确保目标机器已安装 opencode 或 claude-code CLI。
