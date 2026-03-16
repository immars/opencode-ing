/**
 * Session Event Handler
 *
 * Listens for opencode session.idle events and forwards agent responses to Feishu
 */

import type { Event, Part, Message } from '@opencode-ai/sdk';
import { parseChatIdFromTitle } from '../memory/session.js';
import { loadFeishuConfig } from '../config.js';
import { SESSION_PREFIXES } from '../memory/constants.js';
import { logger } from '../logger.js';

interface SessionEventDeps {
  directory: string;
  client: any;
}

const processedMessages = new Set<string>();
const MAX_PROCESSED_CACHE = 100;

function markMessageProcessed(messageId: string): boolean {
  if (processedMessages.has(messageId)) {
    return false;
  }
  processedMessages.add(messageId);
  if (processedMessages.size > MAX_PROCESSED_CACHE) {
    const first = processedMessages.values().next().value;
    if (first) processedMessages.delete(first);
  }
  return true;
}

export async function handleSessionIdle(
  deps: SessionEventDeps,
  sessionId: string
): Promise<void> {
  try {
    const session = await getSessionInfo(deps.client, sessionId);
    
    if (!session?.title?.startsWith(SESSION_PREFIXES.CHAT)) {
      return;
    }

    const chatId = parseChatIdFromTitle(session.title);
    if (!chatId) {
      return;
    }

    const lastAssistantMessage = await getLastAssistantMessage(deps.client, sessionId);
    if (!lastAssistantMessage) {
      return;
    }

    const messageId = lastAssistantMessage.info.id;
    if (!markMessageProcessed(messageId)) {
      logger.debug('SessionEvent', 'Message already processed:', messageId);
      return;
    }

    const textContent = extractTextFromParts(lastAssistantMessage.parts);
    if (!textContent.trim()) {
      return;
    }

    const feishuClient = await getFeishuClientFromConfig(deps.directory);
    if (!feishuClient) {
      logger.error('SessionEvent', 'Could not get Feishu client');
      return;
    }

    const success = await sendToFeishu(feishuClient, chatId, textContent);
    if (success) {
      logger.info('SessionEvent', 'Sent agent response to Feishu chat:', chatId);
    } else {
      logger.error('SessionEvent', 'Failed to send to Feishu chat:', chatId);
    }
  } catch (err) {
    logger.error('SessionEvent', 'Error handling session.idle:', err);
  }
}

export function createSessionEventHandler(deps: SessionEventDeps) {
  return async (input: { event: Event }): Promise<void> => {
    const { event } = input;

    if (event.type === 'session.idle') {
      await handleSessionIdle(deps, event.properties.sessionID);
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

async function sendToFeishu(
  client: { appId: string; appSecret: string },
  chatId: string,
  content: string
): Promise<boolean> {
  const lark = await import('@larksuiteoapi/node-sdk');
  const c = new lark.Client({ appId: client.appId, appSecret: client.appSecret });
  
  try {
    const result = await c.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text: content }),
      },
    });
    return result.code === 0;
  } catch (e) {
    logger.error('SessionEvent', 'Failed to send message to Feishu:', e);
    return false;
  }
}
