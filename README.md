# OpenCode-ing

一个从 OpenCode 启动的长期运行 AI Agent，类似于 nanoclaw，支持飞书集成和记忆管理。

## 功能特性

- **长期在线** - 持续监听和处理任务
- **自主运行** - 独立执行任务，无需持续干预
- **记忆管理** - 短期+长期记忆，支持上下文注入
- **飞书集成** - 通过飞书 API 收发消息

## 快速开始

### 1. 安装插件

在项目目录中配置 OpenCode 插件：

```bash
# 确保 .opencode 目录存在
mkdir -p .opencode

# 配置插件（已在 .opencode/opencode.json 中配置）
```

插件会自动从 `.opencode/code-ing/` 目录加载。

### 2. 配置飞书（如需要）

编辑 `.code-ing/config/feishu.yaml`：

```yaml
# 飞书应用凭证 (必填)
app_id: 'your_app_id'
app_secret: 'your_app_secret'

# 消息配置
message:
  poll_interval: 5
  group_ids: []
```

### 3. 配置 Agent（如需要）

编辑 `.code-ing/config/agent.yaml`：

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

### 4. 启动 OpenCode

```bash
cd /path/to/your/project
opencode .
```

## 工作目录结构

```
.code-ing/                      # Agent 工作根目录
├── config/
│   ├── feishu.yaml            # 飞书配置
│   └── agent.yaml             # Agent 配置
└── workspace/
    ├── short-term/
    │   └── sessions/          # 短期记忆
    │       └── {session}.md
    └── long-term/             # 长期记忆
        └── *.md
```

## 记忆系统

### 短期记忆

- 存储在 `.code-ing/workspace/short-term/sessions/`
- 每个会话一个 Markdown 文件
- 包含当前会话的对话记录

### 长期记忆

- 存储在 `.code-ing/workspace/long-term/`
- 重要信息持久化
- Agent 自动将短期记忆合并到长期记忆

### Context 注入

每次触发 agent 时，会自动注入：
1. 记忆目录结构
2. 长期记忆内容
3. 当前会话记忆

## 使用方法

### 自动触发

OpenCode 启动后 10 秒，插件会自动触发 agent：

```
你好，请介绍一下你自己
```

### 手动触发

在 OpenCode 中切换到 `Assistant` agent（Tab 键），或者使用 `@Assistant` 提及。

## 项目结构

```
.
├── .opencode/
│   ├── agents/
│   │   └── assistant.md       # Agent 定义
│   ├── code-ing/
│   │   └── src/
│   │       ├── index.ts      # 主插件
│   │       ├── memory.ts     # 记忆管理
│   │       └── feishu.ts    # 飞书集成
│   └── opencode.json         # 插件配置
├── .code-ing/                # Agent 工作目录
│   ├── config/
│   └── workspace/
└── scripts/
    └── launch-agent.ts       # SDK 启动脚本
```

## 依赖

- OpenCode >= 1.2.24
- Node.js >= 18

## 开发

### 构建插件

```bash
cd .opencode/code-ing
npm install
npm run build
```

### 调试

```bash
opencode --log-level DEBUG .
```

查看日志：
```bash
tail -f ~/.local/share/opencode/log/$(ls -t ~/.local/share/opencode/log/ | head -1)
```

## 参考

- [OpenCode 文档](https://opencode.ai/docs/)
- [nanoclaw](https://github.com/qwibitai/nanoclaw) - 参考实现
