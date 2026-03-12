---
name: ing-setup
description: (project - Skill) 引导配置和启动 OpenCode-ing Agent。首次运行时使用此技能完成飞书认证、API配置和 agent 启动。
---

# OpenCode-ing Agent Setup

引导用户完成 OpenCode-ing agent 的配置和启动。

## 使用场景

- 首次运行时配置 agent
- 更新飞书配置
- 启动/重启 agent

## 操作步骤

### 1. 检查工作目录结构

确保 `.code-ing/` 目录存在：

```bash
ls -la .code-ing/
```

如果不存在，创建目录结构：

```bash
mkdir -p .code-ing/config .code-ing/workspace/short-term/sessions .code-ing/workspace/long-term
```

### 2. 配置飞书连接

编辑 `.code-ing/config/feishu.yaml`：

```bash
code .code-ing/config/feishu.yaml
```

填写以下配置：

```yaml
# 飞书应用凭证 (必填)
app_id: 'your_app_id'
app_secret: 'your_app_secret'

# 长连接 WebSocket 配置 (推荐)
connection:
  enabled: true
  reconnect_interval: 5000

message:
  group_ids: []
```

**获取飞书凭证：**
1. 访问 https://open.feishu.cn/ 创建企业自建应用
2. 添加"机器人"能力
3. 获取 App ID 和 App Secret
4. 在"事件订阅"中启用长连接接收消息

### 3. 配置 Agent（可选）

编辑 `.code-ing/config/agent.yaml`：

```bash
code .code-ing/config/agent.yaml
```

配置项：

```yaml
agent:
  name: 'Assistant'
  trigger: '@Assistant'

memory:
  short_term:
    max_sessions: 10
  long_term:
    consolidation_threshold: 20

llm:
  model: 'claude-sonnet-4-20250514'
```

### 4. 验证配置

```bash
# 检查飞书配置
cat .code-ing/config/feishu.yaml

# 检查 Agent 配置
cat .code-ing/config/agent.yaml
KX|```

### 4. 重新加载配置

配置修改后，调用 code-ing 插件的工具重新加载：

```
请调用 code-ing.reload-feishu 工具来重新加载飞书配置
```

或者查看当前状态：

```
请调用 code-ing.feishu-status 工具查看飞书配置状态
请调用 code-ing.memory-status 工具查看记忆状态
```

### 5. 启动 OpenCode

### 5. 启动 OpenCode

```bash
cd /path/to/your/project
opencode .
```

插件会自动：
- 加载飞书配置
- 建立 WebSocket 长连接
- 10 秒后自动触发 Agent

## 配置文件说明

| 文件 | 说明 |
|------|------|
| `.code-ing/config/feishu.yaml` | 飞书连接配置 |
| `.code-ing/config/agent.yaml` | Agent 运行时配置 |

### feishu.yaml 配置项

| 配置项 | 必填 | 说明 |
|--------|------|------|
| `app_id` | ✅ | 飞书应用 ID |
| `app_secret` | ✅ | 飞书应用密钥 |
| `connection.enabled` | ❌ | 启用长连接 (默认 true) |
| `connection.reconnect_interval` | ❌ | 重连间隔 (默认 5000ms) |
| `message.group_ids` | ❌ | 监听群组 ID 列表 |

### agent.yaml 配置项

| 配置项 | 必填 | 说明 |
|--------|------|------|
| `agent.name` | ❌ | Agent 名称 (默认 Assistant) |
| `agent.trigger` | ❌ | 触发词 (默认 @Assistant) |
| `memory.short_term.max_sessions` | ❌ | 短期记忆保留数 |
| `memory.long_term.consolidation_threshold` | ❌ | 长期记忆整理阈值 |
| `llm.model` | ❌ | LLM 模型 |

## 飞书应用创建步骤

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建"企业自建应用"
3. 添加应用能力 → 机器人
4. 获取 App ID 和 App Secret
5. 配置"事件订阅" → 添加事件 → `im.message.receive_v1`
6. 发布应用

## 注意事项

- 配置文件包含敏感信息，已在 `.gitignore` 中排除
- 长连接需要服务器能访问 `wss://open.feishu.cn`
- Agent 启动后将持续运行，监听飞书消息
