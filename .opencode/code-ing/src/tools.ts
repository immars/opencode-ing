import { tool } from '@opencode-ai/plugin';
import { buildMemoryContext } from './memory.js';
import { loadFeishuConfig } from './config.js';

export interface ToolDeps {
  directory: string;
  connectFeishu: () => Promise<string>;
}

export function createTools(deps: ToolDeps) {
  const { directory, connectFeishu } = deps;

  return {
    'code-ing.reload-feishu': tool({
      description: '重新加载飞书配置并建立连接',
      args: {},
      async execute(args, context) {
        return await connectFeishu();
      },
    }),

    'code-ing.feishu-status': tool({
      description: '获取当前飞书配置状态',
      args: {},
      async execute(args, context) {
        const config = loadFeishuConfig(directory);

        if (!config) {
          return '未找到飞书配置';
        }

        const groupIds = Array.isArray(config.message?.group_ids)
          ? config.message.group_ids.join(', ')
          : '全部';
        return (
          '飞书配置状态:\n- App ID: ' +
          (config.app_id || '未设置') +
          '\n- Connection: ' +
          (config.connection?.enabled ? '长连接 (WebSocket)' : '未启用') +
          '\n- Group IDs: ' +
          groupIds
        );
      },
    }),

    'code-ing.memory-status': tool({
      description: '获取当前记忆状态',
      args: {},
      async execute(args, context) {
        const memCtx = buildMemoryContext(directory, 'feishu_message');
        return (
          '记忆状态:\n- 长期记忆: ' +
          (memCtx.longTermMemory ? '有内容' : '暂无') +
          '\n- 最近消息: ' +
          memCtx.recentMessages.length +
          '条\n- 每日摘要: ' +
          memCtx.dailySummaries.length +
          '条\n- 目录: .code-ing/workspace/'
        );
      },
    }),
  };
}
