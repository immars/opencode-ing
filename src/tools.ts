import { tool } from '@opencode-ai/plugin';
import { buildMemoryContext } from './memory.js';
import { loadFeishuConfig } from './config.js';
import { sendFileToChat } from './feishu.js';
import { getChatIdFromSession } from './memory/session.js';
import { getSessionFiles } from './memory/files.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface ToolDeps {
  directory: string;
  client: any;
  connectFeishu: () => Promise<string>;
}

export function createTools(deps: ToolDeps): Record<string, ReturnType<typeof tool>> {
  const { directory, client, connectFeishu } = deps;

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
        const chatId = context.sessionID ? await getChatIdFromSession(client, context.sessionID) : null;
        const memCtx = buildMemoryContext(directory, 'feishu_message', chatId || 'default');
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

    'code-ing.send-file': tool({
      description: '发送文件到飞书对话',
      args: {
        file_path: tool.schema.string().describe('本地文件路径（绝对路径或相对于项目根目录的路径）'),
        chat_id: tool.schema.string().optional().describe('目标对话ID，默认发送到当前对话'),
      },
      async execute(args, context) {
        const { file_path, chat_id } = args;
        
        const absolutePath = path.isAbsolute(file_path) 
          ? file_path 
          : path.join(directory, file_path);
        
        try {
          await fs.access(absolutePath);
        } catch {
          return `文件不存在: ${absolutePath}`;
        }
        
        let targetChatId: string | undefined = chat_id;
        
        if (!targetChatId && client && context.sessionID) {
          const chatId = await getChatIdFromSession(client, context.sessionID);
          targetChatId = chatId ?? undefined;
        }
        
        if (!targetChatId) {
          return `无法确定目标对话ID。sessionID=${context.sessionID}, client=${client ? 'yes' : 'no'}。请提供 chat_id 参数。`;
        }
        
        const result = await sendFileToChat(directory, targetChatId, absolutePath);
        
        if (result.success) {
          return `文件已发送: ${path.basename(absolutePath)} (message_id: ${result.messageId})`;
        }
        
        return `发送失败: ${result.error}`;
      },
    }),

    'code-ing.list-files': tool({
      description: '列出当前对话中接收到的所有文件',
      args: {
        chat_id: tool.schema.string().optional().describe('对话ID，默认为当前对话'),
      },
      async execute(args, context) {
        let targetChatId: string | undefined = args.chat_id;
        
        if (!targetChatId && client && context.sessionID) {
          const chatId = await getChatIdFromSession(client, context.sessionID);
          targetChatId = chatId ?? undefined;
        }
        
        if (!targetChatId) {
          return '无法确定目标对话ID';
        }
        
        const files = await getSessionFiles(directory, targetChatId);
        
        if (files.length === 0) {
          return '当前对话中没有文件';
        }
        
        const fileList = files.map((f, i) => 
          `${i + 1}. [${f.type}] ${f.original_name}\n   路径: ${f.local_path}\n   大小: ${f.size} bytes`
        ).join('\n\n');
        
        return `当前对话中的文件 (${files.length} 个):\n\n${fileList}`;
      },
    }),
  };
}
