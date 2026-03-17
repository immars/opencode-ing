import { sendMarkdownMessage } from '../feishu.js';
import { writeMessageRecord } from '../memory/levels.js';
import { logger } from '../logger.js';
import {
  addToQueue,
  getQueueLength,
  removeFromQueue,
  setSessionTracking,
  type QueuedMessage,
} from './state.js';

const AGENT_NAME = 'assistant';

export interface QueueDeps {
  client: any;
  directory: string;
}

export async function handleQueueMessage(
  deps: QueueDeps,
  queuedMsg: QueuedMessage,
  chatId: string,
  sessionId: string,
  todayStr: string
): Promise<void> {
  const { directory } = deps;
  const queueLength = addToQueue(chatId, queuedMsg);
  
  try {
    writeMessageRecord(directory, todayStr, {
      timestamp: new Date().toISOString(),
      role: 'user',
      content: queuedMsg.textContent,
      source: 'feishu',
      chat_id: chatId,
      sender_id: queuedMsg.senderId,
      sender_name: queuedMsg.senderName,
    }, chatId);
  } catch (e) {
    logger.error('QueueHandler', 'Failed to write message record:', e);
  }

  const queueMsg = `🤖消息排队中(${queueLength})...回复'/插队'插队`;
  await sendMarkdownMessage(directory, chatId, queueMsg);

  logger.info('QueueHandler', 'Message queued for chat:', chatId, 'queue length:', queueLength);
}

export async function processMessageDirectly(
  deps: QueueDeps,
  msg: QueuedMessage,
  chatId: string,
  sessionId: string,
  todayStr: string,
  timestamp: string
): Promise<void> {
  const { client, directory } = deps;

  setSessionTracking(chatId, {
    lastUpdateTime: Date.now(),
    sessionId,
  });

  try {
    writeMessageRecord(directory, todayStr, {
      timestamp,
      role: 'user',
      content: msg.textContent,
      source: 'feishu',
      chat_id: chatId,
      sender_id: msg.senderId,
      sender_name: msg.senderName,
    }, chatId);
  } catch (e) {
    logger.error('QueueHandler', 'Failed to write message record:', e);
  }

  try {
    await client.session.promptAsync({
      path: { id: sessionId },
      body: {
        agent: AGENT_NAME,
        parts: [{ type: 'text', text: msg.textContent }],
      },
    });

    logger.info('QueueHandler', 'Message sent via promptAsync to session:', sessionId);
  } catch (err) {
    logger.error('QueueHandler', 'Error sending message via promptAsync:', err);
  }
}

export async function processQueueIfExists(
  deps: QueueDeps,
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

  logger.info('QueueHandler', 'Processing queued message for chat:', chatId, 'remaining:', queueLength - 1);

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
    logger.error('QueueHandler', 'Failed to send queued message:', err);
  }
}
