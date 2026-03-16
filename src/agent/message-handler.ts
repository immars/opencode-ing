import { createFeishuClient, sendMarkdownMessage, addReaction, removeReaction, parseFeishuMessageContent } from '../feishu.js';
import { getOrCreateChatSession } from '../memory/session.js';
import { saveContact } from '../contacts.js';
import { writeMessageRecord } from '../memory/levels.js';
import { prettifyMessage } from '../prettifier.js';
import { logger } from '../logger.js';
import {
  addToQueue,
  getQueueLength,
  setSessionTracking,
  setChatSessionMapping,
  getSessionTracking,
  clearSessionTracking,
  type QueuedMessage,
} from './state.js';

const AGENT_NAME = 'assistant';
const CUT_IN_COMMAND = '/插队';

export interface MessageHandlerDeps {
  client: any;
  directory: string;
}

export async function handleFeishuMessage(
  deps: MessageHandlerDeps,
  msg: any
): Promise<void> {
  const { client, directory } = deps;

  const chatId = msg.message?.chat_id;
  const chatType = msg.message?.chat_type;
  const messageId = msg.message?.message_id;
  const rawContent = msg.message?.content || '';
  const senderId = msg.sender?.sender_id?.open_id;
  const senderName = msg.sender?.sender?.tenant_key;
  const textContent = parseFeishuMessageContent(rawContent);

  if (!textContent || !chatId) return;

  if (messageId) {
    try {
      await addReaction(directory, messageId);
    } catch (e) {
      logger.error('MessageHandler', 'Failed to add reaction:', e);
    }
  }

  try {
    saveContact(directory, chatId, chatType || 'p2p');
  } catch (e) {
    logger.error('MessageHandler', 'Failed to save contact:', e);
  }

  const sessionId = await getOrCreateChatSession(client, directory, chatId);
  
  if (!sessionId) {
    logger.error('MessageHandler', 'Failed to get session ID');
    if (messageId) {
      await removeReaction(directory, messageId);
    }
    return;
  }

  setChatSessionMapping(chatId, sessionId);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const timestamp = new Date().toISOString();

  if (textContent === CUT_IN_COMMAND) {
    await handleCutInCommand(deps, chatId, sessionId, messageId, directory, todayStr);
    return;
  }

  try {
    const statusResult = await client.session.status();
    const sessionStatus = statusResult.data?.[sessionId];
    const remoteBusy = sessionStatus?.type === 'busy';
    const localBusy = !!getSessionTracking(chatId);
    const isBusy = remoteBusy || localBusy;

    if (isBusy) {
      await handleQueueMessage(deps, {
        textContent,
        messageId: messageId || '',
        timestamp: Date.now(),
        senderId,
        senderName,
      }, chatId, sessionId, directory, todayStr);
    } else {
      await processMessageDirectly(deps, {
        textContent,
        messageId: messageId || '',
        timestamp: Date.now(),
        senderId,
        senderName,
      }, chatId, sessionId, directory, todayStr, timestamp);
    }
  } catch (err) {
    logger.error('MessageHandler', 'Error checking session status:', err);
    await processMessageDirectly(deps, {
      textContent,
      messageId: messageId || '',
      timestamp: Date.now(),
      senderId,
      senderName,
    }, chatId, sessionId, directory, todayStr, timestamp);
  } finally {
    if (messageId) {
      await removeReaction(directory, messageId);
    }
  }
}

async function handleCutInCommand(
  deps: MessageHandlerDeps,
  chatId: string,
  sessionId: string,
  messageId: string | undefined,
  directory: string,
  todayStr: string
): Promise<void> {
  const { client } = deps;
  const tracking = getSessionTracking(chatId);

  logger.info('MessageHandler', 'Cut-in command received for chat:', chatId);

  try {
    const statusResult = await client.session.status();
    const sessionStatus = statusResult.data?.[sessionId];
    const isBusy = sessionStatus?.type === 'busy';

    if (isBusy) {
      logger.info('MessageHandler', 'Aborting busy session for cut-in:', sessionId);
      await client.session.abort({ path: { id: sessionId } });
      clearSessionTracking(chatId);
    }

    await sendMarkdownMessage(directory, chatId, '⚡ 已取消当前任务，准备处理下一条消息...');
  } catch (err) {
    logger.error('MessageHandler', 'Error handling cut-in command:', err);
  } finally {
    if (messageId) {
      await removeReaction(directory, messageId);
    }
  }
}

async function handleQueueMessage(
  deps: MessageHandlerDeps,
  queuedMsg: QueuedMessage,
  chatId: string,
  sessionId: string,
  directory: string,
  todayStr: string
): Promise<void> {
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
    logger.error('MessageHandler', 'Failed to write message record:', e);
  }

  const queueMsg = `🤖消息排队中(${queueLength})...回复'/插队'插队`;
  await sendMarkdownMessage(directory, chatId, queueMsg);

  logger.info('MessageHandler', 'Message queued for chat:', chatId, 'queue length:', queueLength);
}

async function processMessageDirectly(
  deps: MessageHandlerDeps,
  msg: QueuedMessage,
  chatId: string,
  sessionId: string,
  directory: string,
  todayStr: string,
  timestamp: string
): Promise<void> {
  const { client } = deps;

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
    logger.error('MessageHandler', 'Failed to write message record:', e);
  }

  try {
    await client.session.promptAsync({
      path: { id: sessionId },
      body: {
        agent: AGENT_NAME,
        parts: [{ type: 'text', text: msg.textContent }],
      },
    });

    logger.info('MessageHandler', 'Message sent via promptAsync to session:', sessionId);
  } catch (err) {
    logger.error('MessageHandler', 'Error sending message via promptAsync:', err);
  }
}
