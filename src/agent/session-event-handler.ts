import type { Event, Part, Message } from '@opencode-ai/sdk';
import { parseChatIdFromTitle } from '../memory/session.js';
import { loadFeishuConfig } from '../config.js';
import { SESSION_PREFIXES } from '../memory/constants.js';
import { writeMessageRecord } from '../memory/levels.js';
import { logger } from '../logger.js';
import { sendMarkdownMessage, sendMessage } from '../feishu.js';
import { prettifyMessage } from '../prettifier.js';
import {
  markMessageProcessed,
  getChatIdBySessionId,
  updateLastUpdateTime,
  clearSessionTracking,
  getQueueLength,
  removeFromQueue,
  setSessionTracking,
  getSessionIdByChatId,
} from '../state.js';

interface SessionEventDeps {
  directory: string;
  client: any;
}

const AGENT_NAME = 'assistant';

export async function handleSessionIdle(
  deps: SessionEventDeps,
  sessionId: string
): Promise<void> {
  const { client, directory } = deps;
  
  try {
    const session = await getSessionInfo(client, sessionId);
    
    if (!session?.title?.startsWith(SESSION_PREFIXES.CHAT)) {
      return;
    }

    const chatId = parseChatIdFromTitle(session.title);
    if (!chatId) {
      return;
    }

    clearSessionTracking(chatId);

    const lastAssistantMessage = await getLastAssistantMessage(client, sessionId);
    if (!lastAssistantMessage) {
      await processQueueIfExists(deps, chatId, sessionId);
      return;
    }

    const messageId = lastAssistantMessage.info.id;
    if (!markMessageProcessed(messageId)) {
      logger.debug('SessionEvent', 'Message already processed:', messageId);
      return;
    }

    const textContent = extractTextFromParts(lastAssistantMessage.parts);
    if (!textContent.trim()) {
      await processQueueIfExists(deps, chatId, sessionId);
      return;
    }

    const pretty = prettifyMessage(textContent);
    let success = await sendMarkdownMessage(directory, chatId, pretty.text);
    
    if (!success) {
      logger.warn('SessionEvent', 'Failed to send markdown card, falling back to plain text:', chatId);
      success = await sendMessage(directory, chatId, pretty.text);
    }

    if (success) {
      logger.info('SessionEvent', 'Sent agent response to Feishu chat:', chatId);
    } else {
      logger.error('SessionEvent', 'Failed to send to Feishu chat even after fallback:', chatId);
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    try {
      writeMessageRecord(directory, todayStr, {
        timestamp: new Date().toISOString(),
        role: 'assistant',
        content: textContent,
        source: 'feishu',
        chat_id: chatId,
      }, chatId);
    } catch (e) {
      logger.error('SessionEvent', 'Failed to write message record:', e);
    }

    await processQueueIfExists(deps, chatId, sessionId);
  } catch (err) {
    logger.error('SessionEvent', 'Error handling session.idle:', err);
  }
}

export async function handleSessionUpdated(
  deps: SessionEventDeps,
  sessionId: string
): Promise<void> {
  const chatId = getChatIdBySessionId(sessionId);
  if (chatId) {
    updateLastUpdateTime(chatId);
    logger.debug('SessionEvent', 'Updated lastUpdateTime for chat:', chatId);
  }
}

async function processQueueIfExists(
  deps: SessionEventDeps,
  chatId: string,
  sessionId: string
): Promise<void> {
  const { client } = deps;
  const queueLength = getQueueLength(chatId);
  
  if (queueLength === 0) {
    return;
  }

  const nextMsg = removeFromQueue(chatId);
  if (!nextMsg) return;

  logger.info('SessionEvent', 'Processing queued message for chat:', chatId, 'remaining:', queueLength - 1);

  setSessionTracking(chatId, {
    lastUpdateTime: Date.now(),
    sessionId,
  });

  try {
    await client.session.promptAsync({
      path: { id: sessionId },
      body: {
        agent: AGENT_NAME,
        parts: [{ type: 'text', text: nextMsg.textContent }],
      },
    });
  } catch (err) {
    logger.error('SessionEvent', 'Failed to send queued message:', err);
  }
}

export function createSessionEventHandler(deps: SessionEventDeps) {
  return async (input: { event: Event }): Promise<void> => {
    const { event } = input;

    if (event.type === 'session.idle') {
      await handleSessionIdle(deps, event.properties.sessionID);
    } else if (event.type === 'session.updated') {
      const sessionId = event.properties.info.id;
      await handleSessionUpdated(deps, sessionId);
    }
  };
}

async function getSessionInfo(client: any, sessionId: string): Promise<{ id: string; title?: string } | null> {
  try {
    const response = await client.session.get({
      path: { id: sessionId },
    });
    return response?.data ?? null;
  } catch {
    return null;
  }
}

async function getLastAssistantMessage(
  client: any,
  sessionId: string
): Promise<{ info: Message; parts: Part[] } | null> {
  try {
    const response = await client.session.messages({
      path: { id: sessionId },
      query: { limit: 10 },
    });

    const messages = response?.data || [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.info?.role === 'assistant' && msg.info?.time?.completed) {
        return msg;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function extractTextFromParts(parts: Part[]): string {
  const textParts: string[] = [];
  
  for (const part of parts) {
    if (part.type === 'text') {
      textParts.push((part as any).text || '');
    }
  }

  return textParts.join('\n');
}

async function getFeishuClientFromConfig(directory: string): Promise<{ appId: string; appSecret: string } | null> {
  const config = loadFeishuConfig(directory);
  if (!config?.app_id || !config?.app_secret) {
    return null;
  }
  return { appId: config.app_id, appSecret: config.app_secret };
}
