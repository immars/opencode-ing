# 项目目标

* 项目起名 opencode-ing
* 一个从opencode启动的类似 nanoclaw 的 agent

主要功能如下：

## 启动方式

从opencode启动。使用方法为：在opencode-ing目录下，启动opencode；然后opencode会多出一个 `/ing-setup` 的命令；这个命令会启动onboard + 启动的序列，启动一类长期主动工作的agent。

## agent行为

跟nanoclaw/openclaw 类似，核心能力包括：

1.长期在线
2.自主运行
3.长短期记忆管理
4.和飞书打通
5.自我及时复盘，整理进化等等

## 实现考虑

* agent部分，能复用opencode本身的框架尽量复用。
* 通过飞书消息、定时触发、opencode 会话等，驱动agent完成任务。
* 参考 nanoclaw的实现。


