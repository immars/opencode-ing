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
import { loadFeishuConfig, getFeishuContext, formatContextAsPrompt } from './memory.js';
import { readSoul, readCronSys } from './memory/levels.js';
import { SESSION_PREFIXES } from './memory/constants.js';
import { getChatIdFromSession } from './memory/session.js';
import { createFeishuClient, createWSClient, closeWSClient, checkConnection, sendMessage, getFeishuWSClient, setFeishuWSClient } from './feishu.js';
import { handleFeishuMessage } from './agent/message-handler.js';
import { createSessionEventHandler } from './agent/session-event-handler.js';
import { createTools } from './tools.js';
import { startSchedulerWithAgent, testTriggerAllCronSys } from './scheduler/index.js';
import { loadContacts } from './contacts.js';
import { setLoggerClient, logger } from './logger.js';
import { startStuckDetector } from './agent/stuck-detector.js';
import {
  setStuckDetectorTimer,
} from './agent/state.js';
import {
  getHeartbeatTimer,
  setHeartbeatTimer,
} from './feishu.js';

const HEARTBEAT_INTERVAL = 2 * 60 * 60 * 1000; // 2小时检测一次（飞书SDK自带重连机制）

export const codeIng: Plugin = async (ctx): Promise<Hooks> => {
  const { client, directory } = ctx;

  setLoggerClient(client);

  // 启动心跳检测(只检测连接状态，不主动触发重连，依赖飞书SDK的自动重连)
  const startHeartbeat = () => {
    const existingTimer = getHeartbeatTimer();
    if (existingTimer) {
      clearInterval(existingTimer);
    }
    const timer = setInterval(async () => {
      const connected = await checkConnection(directory);
      if (!connected) {
        logger.warn('Feishu', 'Heartbeat check failed, waiting for SDK auto-reconnect...');
      } else {
        logger.info('Feishu', 'Heartbeat check: OK');
      }
    }, HEARTBEAT_INTERVAL);
    setHeartbeatTimer(timer);
  };

  startSchedulerWithAgent(directory, client);

  const stuckDetectorTimer = startStuckDetector({ client, directory });
  setStuckDetectorTimer(stuckDetectorTimer);

  // 测试：10秒后触发一次 cron_sys 任务
  setTimeout(() => {
    logger.info('code-ing', 'Testing cron_sys trigger...');
    testTriggerAllCronSys(directory, client, readCronSys).catch(err => {
      logger.error('code-ing', 'Test cron_sys trigger failed', err);
    });
  }, 10000);

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

    const existingWSClient = getFeishuWSClient();
    if (existingWSClient) {
      closeWSClient(existingWSClient);
    }

    logger.info('code-ing', 'Connecting to Feishu...');
    const newWSClient = await createWSClient(feishuClient, {
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
          await sendMessage(directory, recentContact.chatId, '🤖 Assistant 启动成功！');
        }
      },
      onDisconnect: async () => {
        logger.warn('Feishu', 'WebSocket disconnected, will auto-reconnect...');
      },
    });

    if (!newWSClient) {
      return '飞书连接失败';
    }

    setFeishuWSClient(newWSClient);

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

  type SessionType = 'chat' | 'cron_sys' | 'other';
  const sessionTypeCache = new Map<string, SessionType>();

  const getSessionType = async (sessionId: string): Promise<{ type: SessionType; title: string }> => {
    if (sessionTypeCache.has(sessionId)) {
      return { type: sessionTypeCache.get(sessionId)!, title: '(cached)' };
    }

    try {
      const resp = await client.session.get({ path: { id: sessionId } });
      const title = resp?.data?.title || '';

      let type: SessionType;
      if (title.startsWith(SESSION_PREFIXES.CHAT)) {
        type = 'chat';
      } else if (title.startsWith(SESSION_PREFIXES.CRON_SYS)) {
        type = 'cron_sys';
      } else {
        type = 'other';
      }

      sessionTypeCache.set(sessionId, type);
      return { type, title };
    } catch {
      return { type: 'other', title: '(error)' };
    }
  };

  const handleSystemTransform: Hooks['experimental.chat.system.transform'] = async (input, output) => {
    const sessionId = input.sessionID;
    if (!sessionId) return;

    const { type: sessionType } = await getSessionType(sessionId);

    if (sessionType === 'chat') {
      try {
        const chatId = await getChatIdFromSession(client, sessionId);
        const memoryContext = getFeishuContext(directory, chatId || 'default');
        const contextPrompt = formatContextAsPrompt(memoryContext);

        if (contextPrompt) {
          output.system.push(`[Memory Context]\n\n${contextPrompt}`);
        }
      } catch (err) {
        // Context injection failure is non-critical, suppress to avoid disrupting chat
      }
    } else if (sessionType === 'cron_sys') {
      try {
        // 清除所有其他 context（项目知识、skills等），因为 cron_sys 任务不需要
        output.system.length = 0;
        const soul = readSoul(directory);
        if (soul) {
          output.system.push(`[Memory Context]\n\n## Agent Personality (SOUL)\n${soul}`);
        }
      } catch (err) {
        // Context injection failure is non-critical, suppress to avoid disrupting cron
      }
    }
  };

  return {
    tool: tools,
    event: handleSessionEvent,
    'experimental.chat.system.transform': handleSystemTransform,
  };
};

export default codeIng;
