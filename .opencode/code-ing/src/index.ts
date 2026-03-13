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
import { startSchedulerWithAgent, testTriggerAllCronSys } from './scheduler.js';
import { loadContacts } from './contacts.js';

const HEARTBEAT_INTERVAL = 30 * 60 * 1000;

export const codeIng: Plugin = async (ctx): Promise<Hooks> => {
  const { client, directory } = ctx;
  console.error('[code-ing] directory:', directory);

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
        console.error("[Feishu] Connection lost, attempting to reconnect...");
        await connectFeishu();
      } else {
        console.error("[Feishu] Heartbeat: connection OK");
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
    const config = loadFeishuConfig(directory);

    if (!config) {
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

    feishuWSClient = await createWSClient(feishuClient, {
      onMessage: async (msg: any) => {
        await handleFeishuMessage({ client, directory }, msg);
      },
      onConnect: async () => {
        console.error('[code-ing] [Feishu] onConnect triggered');
        
        testTriggerAllCronSys(directory, client);
        
        const contacts = loadContacts(directory);
        if (contacts.length > 0) {
          const recentContact = contacts[0];
          console.error('[code-ing] [Feishu] Sending startup message to:', recentContact.chatId);
          const sent = await sendMessage(feishuClient, recentContact.chatId, '🤖 Assistant 启动成功！');
          if (sent) {
            console.error('[code-ing] [Feishu] Startup message sent successfully');
          } else {
            console.error('[code-ing] [Feishu] Failed to send startup message');
          }
        } else {
          console.error('[code-ing] [Feishu] No recent contacts found');
        }
      },
      onDisconnect: async () => {},
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
      await connectFeishu();
    }
  }, 2000);

  const tools = createTools({ directory, connectFeishu });

  return {
    tool: tools,
  };
};

export default codeIng;
