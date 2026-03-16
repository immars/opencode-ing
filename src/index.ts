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
import { readSoul } from './memory/levels.js';
import { SESSION_PREFIXES } from './memory/constants.js';
import { createFeishuClient, createWSClient, closeWSClient, checkConnection, sendMessage } from './feishu.js';
import { handleFeishuMessage } from './agent/message-handler.js';
import { createSessionEventHandler } from './agent/session-event-handler.js';
import { createTools } from './tools.js';
import { startSchedulerWithAgent } from './scheduler.js';
import { loadContacts } from './contacts.js';
import { setLoggerClient, logger } from './logger.js';

const HEARTBEAT_INTERVAL = 2 * 60 * 60 * 1000; // 2小时检测一次（飞书SDK自带重连机制）

export const codeIng: Plugin = async (ctx): Promise<Hooks> => {
  const { client, directory } = ctx;

  setLoggerClient(client);

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

    const { type: sessionType, title } = await getSessionType(sessionId);
    logger.info('SystemTransform', `sessionId=${sessionId?.slice(0, 8)}... title="${title}" type=${sessionType}`);

    if (sessionType === 'chat') {
      try {
        const memoryContext = getFeishuContext(directory);
        const contextPrompt = formatContextAsPrompt(memoryContext);

        if (contextPrompt) {
          output.system.push(`[Memory Context]\n\n${contextPrompt}`);
          logger.info('SystemTransform', `Injected full context (${contextPrompt.length} chars)`);
        }
      } catch (err) {
        logger.error('code-ing', 'Failed to inject memory context:', err);
      }
    } else if (sessionType === 'cron_sys') {
      try {
        const soul = readSoul(directory);
        if (soul) {
          output.system.push(`[Memory Context]\n\n## Agent Personality (SOUL)\n${soul}`);
          logger.info('SystemTransform', `Injected SOUL context (${soul.length} chars)`);
        }
      } catch (err) {
        logger.error('code-ing', 'Failed to inject SOUL context:', err);
      }
    } else {
      logger.info('SystemTransform', 'No context injection (session type=other)');
    }
  };

  return {
    tool: tools,
    event: handleSessionEvent,
    'experimental.chat.system.transform': handleSystemTransform,
  };
};

export default codeIng;
