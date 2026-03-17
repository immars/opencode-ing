import { addReaction, removeReaction, parseFeishuMessageContent } from '../feishu.js';
import { getOrCreateChatSession } from '../memory/session.js';
import { saveContact } from '../contacts.js';
import { logger } from '../logger.js';
import { setChatSessionMapping, getSessionTracking } from './state.js';
import { CUT_IN_COMMAND, handleCutInCommand } from './commands.js';
import { handleQueueMessage, processMessageDirectly } from './queue.js';

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
    await handleCutInCommand(deps, chatId, sessionId, messageId);
    return;
  }

  try {
    const statusResult = await client.session.status();
    const sessionStatus = statusResult.data?.[sessionId];
    const remoteBusy = sessionStatus?.type === 'busy';
    const localBusy = !!getSessionTracking(chatId);
    const isBusy = remoteBusy || localBusy;

    const queuedMsg = {
      textContent,
      messageId: messageId || '',
      timestamp: Date.now(),
      senderId,
      senderName,
    };

    if (isBusy) {
      await handleQueueMessage(deps, queuedMsg, chatId, sessionId, todayStr);
    } else {
      await processMessageDirectly(deps, queuedMsg, chatId, sessionId, todayStr, timestamp);
    }
  } catch (err) {
    logger.error('MessageHandler', 'Error checking session status:', err);
    await processMessageDirectly(deps, {
      textContent,
      messageId: messageId || '',
      timestamp: Date.now(),
      senderId,
      senderName,
    }, chatId, sessionId, todayStr, timestamp);
  } finally {
    if (messageId) {
      await removeReaction(directory, messageId);
    }
  }
}
