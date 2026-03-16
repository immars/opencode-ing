import { createFeishuClient, sendMarkdownMessage, addReaction, removeReaction } from '../feishu.js';
import { getOrCreateChatSession } from '../memory/session.js';
import { saveContact } from '../contacts.js';
import { writeMessageRecord } from '../memory/levels.js';
import { prettifyMessage } from '../prettifier.js';
import { logger } from '../logger.js';

const AGENT_NAME = 'assistant';

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
  let textContent = rawContent;

  try {
    const parsed = JSON.parse(rawContent);
    textContent = parsed.text || rawContent;
  } catch (e) {
  }

  if (textContent && chatId) {
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

    // 先获取/创建session（此时L0不包含当前消息，避免context重复）
    const sessionId = await getOrCreateChatSession(client, directory, chatId);
    
    // 然后记录当前消息到L0
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const timestamp = new Date().toISOString();
    
    try {
      writeMessageRecord(directory, todayStr, {
        timestamp,
        role: 'user',
        content: textContent,
        source: 'feishu',
        chat_id: chatId,
        sender_id: senderId,
        sender_name: senderName,
      }, chatId);
    } catch (e) {
      logger.error('MessageHandler', 'Failed to write message record:', e);
    }
    
    if (!sessionId) {
      logger.error('MessageHandler', 'Failed to get session ID');
      if (messageId) {
        await removeReaction(directory, messageId);
      }
      return;
    }

    try {
      const result = await client.session.prompt({
        path: { id: sessionId },
        body: {
          agent: AGENT_NAME,
          parts: [{ type: 'text', text: textContent }],
        },
      });

      const response = (result as any)?.data;
      const parts = response?.parts || [];

      const textParts = parts.filter((p: any) => p.type === 'text');
      const responseText = textParts.map((p: any) => p.text).join('\n');

      if (responseText) {
        const sendClient = createFeishuClient(directory);
        if (sendClient) {
          const pretty = prettifyMessage(responseText);
          const sent = await sendMarkdownMessage(sendClient, chatId, pretty.text);
          if (!sent) {
            logger.error('MessageHandler', 'Failed to send message to Feishu');
          }
        }
        writeMessageRecord(directory, todayStr, {
          timestamp: new Date().toISOString(),
          role: 'assistant',
          content: responseText,
          source: 'feishu',
          chat_id: chatId,
        }, chatId);
      } else {
        const sendClient = createFeishuClient(directory);
        if (sendClient) {
          const sent = await sendMarkdownMessage(sendClient, chatId, 'Assistant finished processing.');
          if (!sent) {
            logger.error('MessageHandler', 'Failed to send message to Feishu');
          }
        }
      }
    } catch (err: any) {
      logger.error('MessageHandler', 'Error processing feishu message:', err);
    } finally {
      if (messageId) {
        await removeReaction(directory, messageId);
      }
    }
  }
}
