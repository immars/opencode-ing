---
name: ing-setup
description: (project - Skill) 引导配置和启动 OpenCode-ing Agent。首次运行时使用此技能完成飞书认证、API配置和 agent 启动。
---

# OpenCode-ing Agent Setup

引导用户完成 OpenCode-ing agent 的配置和启动。

## 使用场景

- 首次运行时配置 agent
- 更新飞书或 API 配置
- 启动/重启 agent

## 操作步骤

### 1. 检查配置文件

检查 `config/agent.yaml` 是否存在：

```bash
ls config/agent.yaml 2>/dev/null || echo "配置文件不存在，需要创建"
```

如果不存在，从模板复制：

```bash
cp config/agent.yaml.example config/agent.yaml
```

### 2. 引导用户填写配置

打开 `config/agent.yaml`，引导用户填写以下配置项：

**飞书配置** (必填):
- `feishu.app_id` - 飞书应用 ID（从飞书开放平台获取）
- `feishu.app_secret` - 飞书应用密钥

**OpenCode 配置** (必填):
- `opencode.api_key` - API Key
- `opencode.model` - 模型选择（默认 claude-sonnet-4-20250514）

**Agent 配置** (可选):
- `agent.name` - Agent 名称（默认 "Assistant"）
- `agent.trigger` - 触发词（默认 "@Assistant"）

### 3. 验证配置

确认必填项已填写：

```bash
# 检查 YAML 配置是否有效
cat config/agent.yaml
```

### 4. 创建必要目录

确保工作目录存在：

```bash
mkdir -p groups store
```

HP|### 5. 创建 OpenCode Agent
JQ|
VB|确保 `.opencode/agents/assistant.md` 存在：
RN|
BV|```bash
WY|ls .opencode/agents/assistant.md
MM|```
XA|
SQ|如果没有，创建 agent 定义（已预置在项目中）。
RN|
HP|### 6. 启动 Agent

bash scripts/start-agent.sh
bash scripts/start-agent.sh
```

## 配置文件说明

配置文件位于 `config/agent.yaml`，模板参见 `config/agent.yaml.example`。

| 配置项 | 必填 | 说明 |
|--------|------|------|
| `feishu.app_id` | ✅ | 飞书应用 ID |
| `feishu.app_secret` | ✅ | 飞书应用密钥 |
| `opencode.api_key` | ✅ | OpenCode API Key |
| `opencode.model` | ❌ | LLM 模型 (默认 claude-sonnet-4-20250514) |
| `agent.name` | ❌ | Agent 显示名称 |
| `agent.trigger` | ❌ | 飞书消息触发词 |
| `groups.main` | ❌ | 主分组目录名 |

## 注意事项

- 配置文件包含敏感信息，已在 `.gitignore` 中排除
- 首次运行前必须完成飞书应用创建（参见飞书开放平台文档）
- Agent 启动后将持续运行，监听飞书消息
