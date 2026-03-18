# OpenCode-ing 🤖

OpenCode-ing 是一个基于 `OpenCode` 平台的长期运行的自主 AI Agent 插件。它深度集成了**飞书（Feishu）**消息平台，使其能够实时响应用户的飞书消息，并拥有独立的高级分级持久化记忆系统，可用于复杂的长期对话与任务执行。

## 主要特点

- **安全性 ≈ Opencode。** Agent 处于 Opencode 的框架之内运行。如果你的工作环境认为Openclaw风险太大，但Opencode可以接受，那么 opencode-ing **理论上** 跟opencode 一样安全。
- **实现简单。** 功能不多，代码量不大；有什么问题可以直接修改，风险也比较小。应对固定的自动化工作场景应该足够了。
- **可复用Opencode的能力。** Opencode配置的全局skill，这个Assistant Agent也有。具有直接上手开发的能力。


## ✨ 核心特性

- 🧠 **分层持久化记忆系统**：实现了多个层级的长短期记忆管理。
- 💬 **飞书无缝集成**：使用飞书 SDK 的 WebSocket 长轮询，实现低延迟的实时消息处理。
- ⏰ **定时任务调度 (Cron Tasks)**：支持自主触发的定时任务执行。
- 🔄 **会话与状态管理**：智能切分与管理 LLM 上下文 Token，防止上下文溢出。

## 🛠️ 技术栈

- [TypeScript](https://www.typescriptlang.org/) (ES Modules)
- [Node.js](https://nodejs.org/)
- [@larksuiteoapi/node-sdk](https://github.com/larksuite/node-sdk) (飞书官方 SDK)
- [@opencode-ai/plugin](https://github.com/anomalyco/opencode) (OpenCode 插件框架)

## 📦 快速开始

### 1. 依赖项

你需要安装好一个[opencode](https://opencode.ai/)。

最好也安装上opencode的最佳搭档：[oh-my-opencode](https://github.com/code-yeongyu/oh-my-openagent)。Agent 会默认使用oh-my-opencode所配置的子代理`multimodal-looker`来进行图片识别工作。

请配置好opencode所使用的模型。这些模型也会被Opencode-ing Assistant Agent所使用。配置方法具体可以参考 [opencode 文档](https://opencode.ai/docs/models/)。


### 2. 开发与构建


1. clone 本项目到本地：

```
git clone git@github.com:immars/opencode-ing.git

```

2. 启动opencode：

```
cd opencode-ing
opencode
```

3. 在opencode会话中，使用`/ing-setup` 这个skill开始配置：

```
/ing-setup
```
opencode 的 agent 会引导你填入一些关键信息，比如飞书机器人的`app_id`和`app_secret`，完成配置和工作区准备工作。

飞书机器人的配置，可以参考[这篇文章](https://www.volcengine.com/docs/6396/2189942?lang=zh)


4. 如果配置成功，opencode 会提示你重新启动 opencode：

```
opencode
```

# 以下信息人类可忽略，For LLMs

## 🧠 记忆系统架构

为了实现长期的会话连贯性，OpenCode-ing 设计了层次化的记忆系统，将不同重要性与生命周期的上下文存放在不同的层级中：

| 级别 | 存储路径 | 用途说明 | 容量/数量限制 |
|------|----------|----------|----------|
| **L0** | `memory/{chat_id}/L0/{date}.md` | 原始聊天记录 | 近期 60 条消息 |
| **L1** | `memory/{chat_id}/L1/{date}.md` | 每日内容摘要 | 500 Bytes |
| **L2** | `memory/{chat_id}/LL2/{date}.md` | 每周深度总结 | 500 Bytes |
| **L9** | `memory/{SOUL,PEOPLE,...}.md`| 长期全局记忆 | 无限制 |

- **飞书消息触发**：加载 L9 全局记忆 + 最新的 L0 记录 + 过去 3 天的 L1 + 过去 3 周的 L2。
- **定时任务触发**：加载 L9 全局记忆 + 匹配的 CRON 任务定义。

## 📂 项目结构

```text
opencode-ing/
├── src/                    # 插件核心代码 (TypeScript)
│   ├── index.ts            # 插件入口
│   ├── config.ts           # 配置加载逻辑
│   ├── feishu.ts           # 飞书 SDK 核心交互
│   ├── tools.ts            # OpenCode 工具定义
│   ├── scheduler.ts        # 定时任务调度器
│   ├── memory.ts           # 记忆系统外观入口 (Facade)
│   ├── agent/              # Agent 相关的特殊模块
│   └── memory/             # 具体的 L0/L1/L2/L9 读写实现
├── dist/                   # 构建产物
├── .opencode/
│   ├── plugins/            # 插件软链接
│   ├── skills/             # 项目专用技能 (Skills)
│   └── agents/             # Agent 配置文件
├── templates/              # 初始化向导和配置模板文件
├── doc/                    # 开发与说明文档
└── .code-ing/              # 运行时生成的工作区 (已被 gitignore)
    ├── config/             # 飞书配置存放位置 feishu.yaml
    └── memory/             # 分级记忆文件持久化目录
```

## 📝 开发指南

- **模块引入**：如果引入本地 TypeScript 模块，在 `import` 时必须携带 `.js` 后缀，例如：`import { loadFeishuConfig } from './config.js';`。
- **错误处理**：常规的异步与文件读取失败通常不会抛出异常 (Throw)，而是统一返回 `null` 并在 `stderr` 输出日志。
- **代码规范**：统一返回 `Promise<T | null>` 的形式处理飞书客户端错误，参考 `withLarkClient` 辅助函数。

## 📄 开源协议

本项目采用 MIT 协议开源。
