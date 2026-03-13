# L1压缩
* name: L1记忆压缩
* schedule: `*/30 * * * *`
* description: 请将下列 detail 中的记忆压缩成摘要：<detail>{L0_content}</detail>，然后将摘要内容写在{L1_path}中，覆盖原有内容。
* completion: 确认完成{L1_path}文件的更改

# L2压缩
* name: L2记忆压缩
* schedule: `*/30 * * * *`
* description: 请将下列 detail 中的记忆压缩成摘要：<detail>{L1_content}</detail>，然后将摘要内容写在{L2_path}中，覆盖原有内容。
* completion: 确认完成{L2_path}文件的更改


