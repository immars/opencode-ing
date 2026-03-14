/**
 * code-ing Plugin
 *
 * OpenCode-ing Agent 插件
 * 功能：
 * 1. 查找或创建 "Assistant Managed Session"
 * 2. 飞书连接
 * 3. 记忆系统 Context 注入
 */

import type { Plugin, Hooks } from '@opencode-ai/plugin';
import { buildMemoryContext, loadFeishuConfig, startScheduler, generateDailySummary, generateWeeklySummary } from './memory.js';
import { createFeishuClient, createWSClient, closeWSClient, checkConnection, sendMessage } from './feishu.js';
import { handleFeishuMessage } from './agent/message-handler.js';
import { createTools } from './tools.js';
import { startSchedulerWithAgent } from './scheduler.js';
import { loadContacts } from './contacts.js';

const HEARTBEAT_INTERVAL = 30 * 60 * 1000;

export const codeIng: Plugin = async (ctx): Promise<Hooks> => {
  const { client, directory } = ctx;

  const memoryContext = buildMemoryContext(directory, 'feishu_message');

  const systemPromptWithMemory = `
你是 code-ing agent，有自己的记忆系统。

${memoryContext.directoryInfo}

## 记忆规则
1. 重要信息写入 .code-ing/workspace/long-term/
2. 每轮对话结束总结写入短期记忆
3. 定期将短期记忆合并到长期记忆
`.trim();

  let feishuWSClient: any = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  // 启动心跳检测
  const startHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(async () => {
      const connected = await checkConnection(directory);
      if (!connected) {
        await connectFeishu();
      }
    }, HEARTBEAT_INTERVAL);
  };

  // 启动定时任务调度器 (with agent execution)
  startSchedulerWithAgent(directory, client);

  startScheduler(directory, async (tasks) => {
    for (const task of tasks) {
      if (task.name === 'generate-l1' || task.name === 'daily-summary') {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        await generateDailySummary(directory, todayStr);
      } else if (task.name === 'generate-l2' || task.name === 'weekly-summary') {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        await generateWeeklySummary(directory, weekStartStr);
      }
    }
  });

  const connectFeishu = async (): Promise<string> => {
    console.error('[code-ing] Connecting to Feishu...');
    const config = loadFeishuConfig(directory);

    if (!config) {
      console.error('[code-ing] Feishu config not found');
      return '未找到飞书配置';
    }

    if (!config.app_id || !config.app_secret) {
      return '飞书配置不完整，请填写 app_id 和 app_secret';
    }

    const feishuClient = createFeishuClient(directory);
    if (!feishuClient) {
      return '飞书客户端创建失败';
    }

    if (feishuWSClient) {
      closeWSClient(feishuWSClient);
    }

    console.error('[code-ing] Connecting to Feishu...');
    feishuWSClient = await createWSClient(feishuClient, {
      onMessage: async (msg: any) => {
        try {
          await handleFeishuMessage({ client, directory }, msg);
        } catch (err) {
          console.error('[code-ing] ERROR in handleFeishuMessage:', err);
        }
      },
      onConnect: async () => {
        console.error('[code-ing] Feishu WebSocket connected!');
        const contacts = loadContacts(directory);
        if (contacts.length > 0) {
          const recentContact = contacts[0];
          await sendMessage(feishuClient, recentContact.chatId, '🤖 Assistant 启动成功！');
        }
      },
      onDisconnect: async () => {
        console.error('[code-ing] Feishu WebSocket disconnected');
      },
    });

    if (!feishuWSClient) {
      return '飞书连接失败';
    }

    return (
      '飞书已连接！\n- App ID: ' +
      config.app_id +
      '\n- Connection: 长连接 (WebSocket)'
    );
  };

  setTimeout(async () => {
    const config = loadFeishuConfig(directory);
    if (config && config.app_id && config.app_secret) {
      const result = await connectFeishu();
      if (result.includes('失败') || result.includes('未找到')) {
        console.error('[code-ing] Connection failed:', result);
      }
    }
  }, 2000);

  const tools = createTools({ directory, connectFeishu });

  return {
    tool: tools,
  };
};

export default codeIng;
