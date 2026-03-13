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

调用code-ing plugin暴露出来的`onboard`工具，完成onboard工作。

调用完成以后，根据`onboard`的输出，判断是否成功；

如果成功，则提醒用户重启opencode以让配置生效。

### feishu.yaml 配置项

| 配置项 | 必填 | 说明 |
|--------|------|------|
| `app_id` | ✅ | 飞书应用 ID |
| `app_secret` | ✅ | 飞书应用密钥 |
| `connection.enabled` | ❌ | 启用长连接 (默认 true) |
| `connection.reconnect_interval` | ❌ | 重连间隔 (默认 5000ms) |
| `message.group_ids` | ❌ | 监听群组 ID 列表 |

## 飞书应用创建步骤

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建"企业自建应用"
3. 添加应用能力 → 机器人
4. 获取 App ID 和 App Secret
5. 配置"事件订阅" → 添加事件 → `im.message.receive_v1`
6. 发布应用

