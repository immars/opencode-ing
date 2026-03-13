# 组装逻辑

agent的工作有几种触发方式。code-ing 会往context中注入记忆信息。

* 飞书消息触发。注入：工作目录的根目录； L9中的SOUL.md，PEOPLE.md，TASK.md；L0中，最近60条消息；L1中最近3天的信息；L2中最近3周的信息。剩下的，让agent按需自己读取。
* 定时触发。plugin 通过一个定时器机制，每半个小时整点(xx:00, xx:30) 进行一次定时触发。触发时，需要处理TASK.md的完成情况；以及处理CRON.md, CRON_SYS.md的内容。处理方式如下。

# 定时任务执行逻辑

* 如果TASK.md 用户任务不为空，则让agent执行一次用户任务。注入：工作目录的根目录； L9中的SOUL.md，PEOPLE.md，TASK.md；当前日期时间。
* 如果CRON.md 用户的定时任务不为空，并且匹配当前的触发时间，则让agent执行一次定时任务。注入：工作目录的根目录； L9中的SOUL.md，PEOPLE.md，CRON.md中匹配当前时间的任务条目；当前日期时间。
* 对于CRON_SYS.md 系统任务，并且匹配当前的触发时间，则：对于每条匹配的任务，都触发一次。在一个叫 `cron sys session` 的 session中执行。每次执行注入：SOUL.md，PEOPLE.md，CRON_SYS.md中匹配的单条任务。
** 单条任务的内容，在注入之前，需要进行变量替换。变量是`{` `}` 括起来的部分。支持的变量有：

- `L0`: 待压缩的 L0 级memory内容。
- `L1`: 待压缩的 L1 级memory内容。
- `L1_path`: 压缩L0的时候，待写入的L1级文件的路径。
- `L2_path`: 压缩L1的时候，待写入的L2级文件的路径。

压缩的逻辑请参考`doc/memory-design.md`中的相关描述。

## session 管理

对于CRON_SYS中的任务，`cron sys session` 每次都滚动创建一个新的。滚动的逻辑跟 `doc/memory-design.md` 中描述的managed session类似，不断改名，历史保留5个。
