import { sendMarkdownMessage, removeReaction } from '../feishu.js';
import { logger } from '../logger.js';
import { getSessionTracking, clearSessionTracking } from './state.js';

export interface CommandDeps {
  client: any;
  directory: string;
}

export const CUT_IN_COMMAND = '/插队';

export async function handleCutInCommand(
  deps: CommandDeps,
  chatId: string,
  sessionId: string,
  messageId: string | undefined
): Promise<void> {
  const { client, directory } = deps;
  // const tracking = getSessionTracking(chatId); // Not needed immediately here

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
