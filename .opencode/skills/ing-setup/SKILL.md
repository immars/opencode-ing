---
name: ing-setup
description: (project - Skill) 引导配置和启动 OpenCode-ing Agent。首次运行时使用此技能完成飞书认证、API配置和 agent 启动。
---

# OpenCode-ing Agent Setup

引导用户完成 OpenCode-ing agent 的配置和启动。

## 使用场景

- 首次运行时配置 agent
- 更新飞书配置

### 1. 检查当前的工作目录

- 工作目录的路径，默认 `.code-ing`
- 检查并建立子目录 config 和 memory目录结构：

```
.code-ing/config/
└─── feishu.yaml         # 飞书配置文件

.code-ing/memory/
├── SOUL.md              # Agent 性格与习惯
├── PEOPLE.md            # 用户画像与偏好
├── TASK.md              # 任务记录
├── CRON.md              # 定时任务
├── CRON_SYS.md          # 系统定时任务表
└─── contacts.json       # 联系人数据

 ```

- 上述各项目录，如果没有则创建

### 2. 初始化文件

上述文件，如果没有则初始化：

*feishu.yaml的初始化* 

1. 如果没有feishu.yaml，则从`./templates/config/feishu.yaml` 拷贝到工作目录对应位置，并询问用户飞书 `app_id` 和 `app_secret`，并填入这个文件，代替文件中的相应选项。
2. 如果没有SOUL.md, PEOPLE.md, CRON_SYS.md ，则从 `./templates/memory/` 里面拷贝一份。
3. 如果没有CRON.md, TASK.md，则创建一个空文件。
4. 如果没有contacts.json，则创建内容为 `[]` 的空数组文件（不是 `{}`）。

**获取飞书凭证：**

如果用户不能提供飞书凭证，则给他提示：

1. 访问 https://open.feishu.cn/ 创建企业自建应用
2. 添加"机器人"能力
3. 获取 App ID 和 App Secret
4. 在"事件订阅"中启用长连接接收消息
5. 配置"事件订阅" → 添加事件 → `im.message.receive_v1`
6. 发布应用

*assistant.md 模型的初始化* 

- 询问用户希望使用什么模型来运行Code-ing Assistant，并提示用户可以选择opencode配置好的模型，可以通过 `opencode models` 命令来查看
- 把用户提供的模型，填写在 `./.opencode/agents/assistant.md` 中的第4行，替代原来的 `model` 选项的内容.

### 3. 编译

1. 进到 `.opencode/` 目录，安装依赖。
2. 进到项目目录，进行编译。
3. 进到 `.opencode/plugins/` 目录，建立符号链接：`ln -s ../../dist/index.js code-ing.js`

# 完成

上述步骤都完成后，提示用户 "配置成功，请重启opencode 以生效"


