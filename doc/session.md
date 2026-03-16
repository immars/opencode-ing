# opencode session 管理

session 分为两种：

- 用户session
- 系统session

# 会话创建与销毁

所有类型的session的创建和销毁都遵循相同的规律。创建的时候以名字开头，加上创建时间。销毁采用housekeeping的方式，保留最近的5个会话。

# 聊天session

飞书的不同的用户的聊天会话跟open code上的聊天session一一对应，包括跟不同用户的聊天，以及群聊天。命名："Chat {飞书会话id} {创建时间}"

来自于不同的飞书对话的消息，发送到各自对应的 open code 的聊天session里；各个session中agent的回复，也发送到各自对应的飞书会话中。

# 系统session

第二种类型的session是系统session，以 Cron sys session 开头。

