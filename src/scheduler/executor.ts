import { logger } from '../logger.js';
import { extractTaskContent } from '../memory/cron.js';
import { getTaskContext, getCronContext } from '../memory/context.js';
import { getOrCreateManagedSession, getOrCreateChatSession } from '../memory/session.js';
import { readCron, readCronSys, readTasks, readSessionCron, readSessionCronSys, readSessionTasks } from '../memory/levels.js';
import { listAllSessions } from '../memory/paths.js';
import { getActiveTasksFromContent, executeAgentPrompt } from './utils.js';
import { executeCronSysTask, executeSessionCronSysTask } from './compressor.js';
import { parseCronFile } from '../memory/cron.js';
import type { CronTask } from '../memory/types.js';

export async function executeTask(
  projectDir: string,
  client: any
): Promise<void> {
  try {
    logger.info('Scheduler', 'Executing TASK.md');

    const contextPrompt = getTaskContext(projectDir);
    const sessionId = await getOrCreateManagedSession(client);

    if (!sessionId) {
      logger.error('Scheduler', 'Failed to get or create session for TASK execution');
      return;
    }

    await executeAgentPrompt(client, sessionId, contextPrompt);

    logger.info('Scheduler', 'TASK.md execution completed');
  } catch (err) {
    logger.error('Scheduler', 'Failed to execute TASK:', err);
  }
}

export async function executeCronTask(
  projectDir: string,
  client: any,
  task: CronTask,
  fullCronContent: string
): Promise<void> {
  try {
    logger.info('Scheduler', 'Executing CRON task:', task.name);

    const taskContent = extractTaskContent(fullCronContent, task.name);
    const contextPrompt = getCronContext(projectDir, taskContent);

    let sessionId: string | null = null;
    if (task.author) {
      sessionId = await getOrCreateChatSession(client, projectDir, task.author);
      logger.info('Scheduler', 'Using chat session for author:', task.author);
    } else {
      sessionId = await getOrCreateManagedSession(client);
    }

    if (!sessionId) {
      logger.error('Scheduler', 'Failed to get or create session for CRON execution');
      return;
    }

    await executeAgentPrompt(client, sessionId, contextPrompt);

    logger.info('Scheduler', 'CRON task completed:', task.name);
  } catch (err) {
    logger.error('Scheduler', 'Failed to execute CRON task:', err);
  }
}

export async function executeSessionTask(
  projectDir: string,
  client: any,
  chatId: string,
  taskContent: string
): Promise<void> {
  try {
    logger.info('Scheduler', 'Executing session TASK.md for:', chatId);

    const contextPrompt = taskContent || 'No tasks defined';
    const sessionId = await getOrCreateChatSession(client, projectDir, chatId);

    if (!sessionId) {
      logger.error('Scheduler', 'Failed to get or create session for session TASK execution');
      return;
    }

    await executeAgentPrompt(client, sessionId, contextPrompt);

    logger.info('Scheduler', 'Session TASK.md execution completed for:', chatId);
  } catch (err) {
    logger.error('Scheduler', 'Failed to execute session TASK:', err);
  }
}

export async function executeSessionCronTask(
  projectDir: string,
  client: any,
  task: CronTask,
  fullCronContent: string,
  chatId: string
): Promise<void> {
  try {
    logger.info('Scheduler', 'Executing session CRON task:', task.name, 'for:', chatId);

    const taskContent = extractTaskContent(fullCronContent, task.name);
    const contextPrompt = taskContent || 'No task content';

    const sessionId = await getOrCreateChatSession(client, projectDir, chatId);

    if (!sessionId) {
      logger.error('Scheduler', 'Failed to get or create session for session CRON execution');
      return;
    }

    await executeAgentPrompt(client, sessionId, contextPrompt);

    logger.info('Scheduler', 'Session CRON task completed:', task.name, 'for:', chatId);
  } catch (err) {
    logger.error('Scheduler', 'Failed to execute session CRON task:', err);
  }
}

export async function executeScheduledTasks(
  projectDir: string,
  client: any
): Promise<void> {
  const now = new Date();

  const minute = now.getMinutes();
  if (minute !== 0 && minute !== 30) {
    return;
  }

  logger.info('Scheduler', 'Triggered at', now.toISOString());

  // Execute global tasks
  const taskContent = readTasks(projectDir);
  const cronContent = readCron(projectDir);
  const cronSysContent = readCronSys(projectDir);

  if (taskContent.trim()) {
    await executeTask(projectDir, client);
  }

  for (const task of getActiveTasksFromContent(cronContent, now)) {
    await executeCronTask(projectDir, client, task, cronContent);
  }

  for (const task of getActiveTasksFromContent(cronSysContent, now)) {
    await executeCronSysTask(projectDir, client, task, cronSysContent);
  }

  // Execute per-session tasks
  const sessions = listAllSessions(projectDir);
  for (const chatId of sessions) {
    const sessionTaskContent = readSessionTasks(projectDir, chatId);
    const sessionCronContent = readSessionCron(projectDir, chatId);
    const sessionCronSysContent = readSessionCronSys(projectDir, chatId);

    if (sessionTaskContent.trim()) {
      await executeSessionTask(projectDir, client, chatId, sessionTaskContent);
    }

    for (const task of getActiveTasksFromContent(sessionCronContent, now)) {
      await executeSessionCronTask(projectDir, client, task, sessionCronContent, chatId);
    }

    for (const task of getActiveTasksFromContent(sessionCronSysContent, now)) {
      await executeSessionCronSysTask(projectDir, client, task, sessionCronSysContent, chatId);
    }
  }
}

export async function testTriggerAllCron(
  projectDir: string,
  client: any
): Promise<void> {
  const cronContent = readCron(projectDir);
  const userTasks = parseCronFile(cronContent);
  const enabledUserTasks = userTasks.filter((t: CronTask) => t.enabled);
  
  for (const task of enabledUserTasks) {
    await executeCronTask(projectDir, client, task, cronContent);
  }
}
