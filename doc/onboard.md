
# OpenCode-ing Agent Setup

引导用户完成 OpenCode-ing agent 的配置和启动。

## 使用场景

- 首次运行时配置 agent
- 更新飞书配置

## 操作步骤

### 1. 检查当前的工作目录

- 问询用户工作目录的路径，默认 `.code-ing`
- 检查并建立子目录 config 和 memory目录结构：

```
.:
  - config:
    - feishu.yaml  # 飞书配置文件
  - memory: 
    - L0:	# L0 记忆目录
      - ...
    - L1:	# L1 记忆目录
      - ...
    - L2: 	# L2 记忆目录
    - SOUL.md	# L9 关于自身记忆
    - PEOPLE.md	# L9 关于用户的记忆
    - TASK.md   # 用户任务表
    - CRON.md   # 用户定时任务表
    - CRON_SYS.md # 系统定时任务表
```

- 上述目录，如果没有则创建
- 上述文件，如果没有则初始化：
- 如果没有feishu.yaml，则从`./templates/config/feishu.yaml` 拷贝到工作目录对应位置，并询问用户飞书appid和appsecret，并填入这个文件
- 如果没有SOUL.md, PEOPLE.md, CRON_SYS.md ，则从 `./templates/memory/` 里面拷贝一份。


**获取飞书凭证：**

如果用户不能提供飞书凭证，则给他提示：

1. 访问 https://open.feishu.cn/ 创建企业自建应用
2. 添加"机器人"能力
3. 获取 App ID 和 App Secret
4. 在"事件订阅"中启用长连接接收消息
5. 配置"事件订阅" → 添加事件 → `im.message.receive_v1`
6. 发布应用

# 完成

完成后，返回"配置成功，请重启opencode 以生效"


