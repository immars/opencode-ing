import { addReaction, removeReaction, parseFeishuMessageContent, getUserName } from '../feishu.js';
import { getOrCreateChatSession } from '../memory/session.js';
import { saveContact, findContact } from '../contacts.js';
import { logger } from '../logger.js';
import { processMessageFiles } from './file-handler.js';
import { getTodayString, getNowString } from '../memory/utils.js';
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
  const msgType = msg.message?.message_type;
  const rawContent = msg.message?.content || '';
  const senderId = msg.sender?.sender_id?.open_id;

  let senderName: string | undefined;

  // 处理文件类型消息
  let textContent = '';

  if (['image', 'file', 'audio', 'media', 'post'].includes(msgType)) {
    // 文件消息：下载文件并格式化
    const fileResult = await processMessageFiles(deps, {
      message_id: messageId || '',
      message_type: msgType,
      content: rawContent,
      chat_id: chatId,
    });

    const parsedText = parseFeishuMessageContent(rawContent);

    if (fileResult.success && fileResult.files.length > 0) {
      textContent = parsedText 
        ? `${parsedText}\n\n${fileResult.formattedContent}` 
        : fileResult.formattedContent;
    } else if (!fileResult.success) {
      logger.error('MessageHandler', 'File processing failed:', fileResult.error);
      textContent = parsedText;
    } else {
      textContent = parsedText;
    }
  } else {
    // 文本消息：解析文本内容
    textContent = parseFeishuMessageContent(rawContent);
  }

  if (!textContent || !chatId) return;

  if (messageId) {
    try {
      await addReaction(directory, messageId);
    } catch (e) {
      logger.error('MessageHandler', 'Failed to add reaction:', e);
    }
  }

  if (chatType === 'p2p' && senderId) {
    const existingContact = findContact(directory, chatId);
    if (existingContact?.name) {
      senderName = existingContact.name;
    } else {
      const userInfo = await getUserName(directory, senderId);
      if (userInfo?.name) {
        senderName = userInfo.name;
      }
    }
  } else if (senderId) {
    const userInfo = await getUserName(directory, senderId);
    if (userInfo?.name) {
      senderName = userInfo.name;
    }
  }

  try {
    saveContact(directory, chatId, chatType || 'p2p', senderName);
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

  const todayStr = getTodayString();
  const timestamp = getNowString();

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
  }
}
