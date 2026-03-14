import { createFeishuClient, sendMessage, addReaction, removeReaction } from '../feishu.js';
import { getOrCreateManagedSession } from '../memory/session.js';
import { saveContact } from '../contacts.js';
import { writeMessageRecord } from '../memory/l0.js';
import { prettifyMessage } from '../prettifier.js';

export interface MessageHandlerDeps {
  client: any;
  directory: string;
}

export async function handleFeishuMessage(
  deps: MessageHandlerDeps,
  msg: any
): Promise<void> {
  const { client, directory } = deps;

  console.error('[MessageHandler] Received message:', JSON.stringify(msg).slice(0, 500));

  const chatId = msg.message?.chat_id;
  const chatType = msg.message?.chat_type;
  const messageId = msg.message?.message_id;
  const rawContent = msg.message?.content || '';
  let textContent = rawContent;

  try {
    const parsed = JSON.parse(rawContent);
    textContent = parsed.text || rawContent;
  } catch (e) {
  }

  console.error('[MessageHandler] chatId:', chatId, 'textContent:', textContent?.slice(0, 100));

  if (textContent && chatId) {
    console.error('[MessageHandler] Processing message...');
    
    if (messageId) {
      console.error('[MessageHandler] Adding reaction to message:', messageId);
      try {
        await addReaction(directory, messageId);
        console.error('[MessageHandler] Reaction added successfully');
      } catch (e) {
        console.error('[MessageHandler] ERROR adding reaction:', e);
      }
    }

    console.error('[MessageHandler] Saving contact...');
    try {
      saveContact(directory, chatId, chatType || 'p2p');
      console.error('[MessageHandler] Contact saved');
    } catch (e) {
      console.error('[MessageHandler] ERROR saving contact:', e);
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const timestamp = new Date().toISOString();
    
    console.error('[MessageHandler] Writing message record...');
    try {
      writeMessageRecord(directory, todayStr, {
        timestamp,
        role: 'user',
        content: textContent,
        source: 'feishu',
      });
      console.error('[MessageHandler] Message record written');
    } catch (e) {
      console.error('[MessageHandler] ERROR writing message record:', e);
    }

    console.error('[MessageHandler] Getting or creating managed session...');
    console.error('[MessageHandler] client type:', typeof client, 'client.session type:', typeof client?.session);
    const sessionId = await getOrCreateManagedSession(client, directory);
    console.error('[MessageHandler] Session ID:', sessionId);
    
    if (!sessionId) {
      console.error('[MessageHandler] ERROR: Failed to get session ID');
      if (messageId) {
        await removeReaction(directory, messageId);
      }
      return;
    }

    try {
      console.error('[MessageHandler] Sending prompt to session:', sessionId);
      const result = await client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: [{ type: 'text', text: textContent }],
        },
      });

      console.error('[MessageHandler] Prompt result:', JSON.stringify(result).slice(0, 500));

      const response = (result as any)?.data;
      const parts = response?.parts || [];

      const textParts = parts.filter((p: any) => p.type === 'text');
      const responseText = textParts.map((p: any) => p.text).join('\n');

      console.error('[MessageHandler] Response text length:', responseText?.length);

      if (responseText) {
        const sendClient = createFeishuClient(directory);
        if (sendClient) {
          const pretty = prettifyMessage(responseText);
          console.error('[MessageHandler] Sending reply to chat:', chatId);
          await sendMessage(sendClient, chatId, pretty.text, pretty.useRichText ? pretty.richContent : undefined);
        }
        writeMessageRecord(directory, todayStr, {
          timestamp: new Date().toISOString(),
          role: 'assistant',
          content: responseText,
          source: 'feishu',
        });
      } else {
        const sendClient = createFeishuClient(directory);
        if (sendClient) {
          await sendMessage(sendClient, chatId, 'Assistant finished processing.');
        }
      }
    } catch (err: any) {
      console.error('[MessageHandler] ERROR processing feishu message:', err);
    } finally {
      if (messageId) {
        console.error('[MessageHandler] Removing reaction from message:', messageId);
        await removeReaction(directory, messageId);
      }
    }
  } else {
    console.error('[MessageHandler] Skipping: no textContent or chatId');
  }
}
