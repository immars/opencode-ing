import { createFeishuClient, sendMessage } from '../feishu.js';
import { getOrCreateManagedSession } from './session.js';

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
  const rawContent = msg.message?.content || '';
  let textContent = rawContent;

  try {
    const parsed = JSON.parse(rawContent);
    textContent = parsed.text || rawContent;
  } catch (e) {
  }

  if (textContent && chatId) {
    const sessionId = await getOrCreateManagedSession(client);
    if (!sessionId) {
      return;
    }

    try {
      const result = await client.session.prompt({
        path: { id: sessionId },
        body: {
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
          await sendMessage(sendClient, chatId, responseText);
        }
      } else {
        const sendClient = createFeishuClient(directory);
        if (sendClient) {
          await sendMessage(sendClient, chatId, 'Assistant finished processing.');
        }
      }
    } catch (err: any) {
      console.error('Error processing feishu message:', err);
    }
  }
}
