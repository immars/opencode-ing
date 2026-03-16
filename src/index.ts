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
import { buildMemoryContext, loadFeishuConfig } from './memory.js';
import { createFeishuClient, createWSClient, closeWSClient, checkConnection, sendMessage } from './feishu.js';
import { handleFeishuMessage } from './agent/message-handler.js';
import { createSessionEventHandler } from './agent/session-event-handler.js';
import { createTools } from './tools.js';
import { startSchedulerWithAgent, testTriggerAllCron } from './scheduler.js';
import { loadContacts } from './contacts.js';
import { setLoggerClient, logger } from './logger.js';

const HEARTBEAT_INTERVAL = 2 * 60 * 60 * 1000; // 2小时检测一次（飞书SDK自带重连机制）

export const codeIng: Plugin = async (ctx): Promise<Hooks> => {
  const { client, directory } = ctx;

  setLoggerClient(client);

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

  // 启动心跳检测（只检测连接状态，不主动触发重连，依赖飞书SDK的自动重连）
  const startHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(async () => {
      const connected = await checkConnection(directory);
      if (!connected) {
        logger.warn('Feishu', 'Heartbeat check failed, waiting for SDK auto-reconnect...');
      } else {
        logger.info('Feishu', 'Heartbeat check: OK');
      }
    }, HEARTBEAT_INTERVAL);
  };

  startSchedulerWithAgent(directory, client);

  // Debug: 10秒后触发一次 CRON.md 处理
  setTimeout(async () => {
    logger.info('code-ing', 'Triggering CRON.md debug processing...');
    try {
      await testTriggerAllCron(directory, client);
      logger.info('code-ing', 'CRON.md debug processing completed');
    } catch (err) {
      logger.error('code-ing', 'CRON.md debug processing failed:', err);
    }
  }, 10 * 1000);

  const connectFeishu = async (): Promise<string> => {
    logger.info('code-ing', 'Connecting to Feishu...');
    const config = loadFeishuConfig(directory);

    if (!config) {
      logger.error('code-ing', 'Feishu config not found');
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

    logger.info('code-ing', 'Connecting to Feishu...');
    feishuWSClient = await createWSClient(feishuClient, {
      onMessage: async (msg: any) => {
        try {
          await handleFeishuMessage({ client, directory }, msg);
        } catch (err) {
          logger.error('code-ing', 'ERROR in handleFeishuMessage:', err);
        }
      },
      onConnect: async () => {
        logger.info('code-ing', 'Feishu WebSocket connected!');
        const contacts = loadContacts(directory);
        if (contacts.length > 0) {
          const recentContact = contacts[0];
          await sendMessage(feishuClient, recentContact.chatId, '🤖 Assistant 启动成功！');
        }
      },
      onDisconnect: async () => {
        logger.warn('Feishu', 'WebSocket disconnected, will auto-reconnect...');
      },
    });

    if (!feishuWSClient) {
      return '飞书连接失败';
    }

    // 启动心跳检测
    startHeartbeat();

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
        logger.error('code-ing', 'Connection failed:', result);
      }
    }
  }, 2000);

  const tools = createTools({ directory, client, connectFeishu });

  const handleSessionEvent = createSessionEventHandler({ directory, client });

  return {
    tool: tools,
    event: handleSessionEvent,
  };
};

export default codeIng;
