import { createFeishuClient, sendMessage, addReaction, removeReaction } from '../feishu.js';
import { getOrCreateManagedSession } from '../memory/session.js';
import { getFeishuContext, formatContextAsPrompt } from '../memory/context.js';
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

  if (textContent && chatId) {
    if (messageId) {
      await addReaction(directory, messageId);
    }

    saveContact(directory, chatId, chatType || 'p2p');

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const timestamp = new Date().toISOString();
    writeMessageRecord(directory, todayStr, {
      timestamp,
      role: 'user',
      content: textContent,
      source: 'feishu',
    });

    const sessionId = await getOrCreateManagedSession(client);
    if (!sessionId) {
      if (messageId) {
        await removeReaction(directory, messageId);
      }
      return;
    }

    try {
      const memoryContext = getFeishuContext(directory);
      const contextPrompt = formatContextAsPrompt(memoryContext);
      
      console.error('=== INJECTED CONTEXT START ===');
      console.error(contextPrompt);
      console.error('=== INJECTED CONTEXT END ===');
      
      const fullPrompt = contextPrompt 
        ? `${contextPrompt}\n\n---\n\n## Current User Message\n${textContent}`
        : textContent;

      const result = await client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: [{ type: 'text', text: fullPrompt }],
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
      console.error('Error processing feishu message:', err);
    } finally {
      if (messageId) {
        await removeReaction(directory, messageId);
      }
    }
  }
}
