/**
 * Scheduler - Timer Trigger Engine
 *
 * Triggers at xx:00 and xx:30 every hour
 * Executes TASK.md, CRON.md, and CRON_SYS.md tasks by prompting the agent
 */

import { parseCronFile, getActiveTasks } from './memory/cron.js';
import type { CronTask } from './memory/types.js';
import { readCron, readCronSys, readTasks, readSessionCron, readSessionCronSys, readSessionTasks } from './memory/levels.js';
import { 
  getTaskContext, 
  getCronContext, 
  getCronSysContext, 
  ensureMemoryPaths,
  buildCompressionPrompt,
  extractSummary,
  getL1Path,
  getL2Path
} from './memory/context.js';
import { CronSysSessionManager, getOrCreateManagedSession, getOrCreateChatSession } from './memory/session.js';
import { listAllSessions, getSessionL9FilePath, getSessionL1FilePath, getSessionL2FilePath } from './memory/paths.js';
import { logger } from './logger.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let schedulerClient: any = null;
let schedulerProjectDir: string = '';

/**
 * Start the scheduler with callback for legacy support
 */
export function startScheduler(
  projectDir: string,
  callback: (tasks: CronTask[]) => void
): void {
  if (isRunning) {
    return;
  }

  isRunning = true;

  checkAndRun(projectDir, callback);

  schedulerInterval = setInterval(() => {
    checkAndRun(projectDir, callback);
  }, 60 * 1000);
}

/**
 * Start the scheduler with agent execution support
 */
export function startSchedulerWithAgent(
  projectDir: string,
  client: any
): void {
  if (isRunning) {
    return;
  }

  isRunning = true;
  schedulerClient = client;
  schedulerProjectDir = projectDir;

  executeScheduledTasks(projectDir, client);

  schedulerInterval = setInterval(() => {
    executeScheduledTasks(projectDir, client);
  }, 60 * 1000);
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  isRunning = false;
  schedulerClient = null;
  schedulerProjectDir = '';
}

/**
 * Execute all scheduled tasks by prompting the agent
 */
async function executeScheduledTasks(
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

  const userTasks = parseCronFile(cronContent);
  const systemTasks = parseCronFile(cronSysContent);

  const enabledUserTasks = userTasks.filter((t) => t.enabled);
  const enabledSystemTasks = systemTasks.filter((t) => t.enabled);

  const activeUserTasks = getActiveTasks(enabledUserTasks, now);
  const activeSystemTasks = getActiveTasks(enabledSystemTasks, now);

  if (taskContent.trim()) {
    await executeTask(projectDir, client);
  }

  for (const task of activeUserTasks) {
    await executeCronTask(projectDir, client, task, cronContent);
  }

  for (const task of activeSystemTasks) {
    await executeCronSysTask(projectDir, client, task, cronSysContent);
  }

  // Execute per-session tasks
  const sessions = listAllSessions(projectDir);
  for (const chatId of sessions) {
    const sessionTaskContent = readSessionTasks(projectDir, chatId);
    const sessionCronContent = readSessionCron(projectDir, chatId);
    const sessionCronSysContent = readSessionCronSys(projectDir, chatId);

    const sessionUserTasks = parseCronFile(sessionCronContent);
    const sessionSystemTasks = parseCronFile(sessionCronSysContent);

    const enabledSessionUserTasks = sessionUserTasks.filter((t) => t.enabled);
    const enabledSessionSystemTasks = sessionSystemTasks.filter((t) => t.enabled);

    const activeSessionUserTasks = getActiveTasks(enabledSessionUserTasks, now);
    const activeSessionSystemTasks = getActiveTasks(enabledSessionSystemTasks, now);

    if (sessionTaskContent.trim()) {
      await executeSessionTask(projectDir, client, chatId, sessionTaskContent);
    }

    for (const task of activeSessionUserTasks) {
      await executeSessionCronTask(projectDir, client, task, sessionCronContent, chatId);
    }

    for (const task of activeSessionSystemTasks) {
      await executeSessionCronSysTask(projectDir, client, task, sessionCronSysContent, chatId);
    }
  }
}

/**
 * Execute TASK.md user task
 */
async function executeTask(
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

    await client.session.prompt({
      path: { id: sessionId },
      body: {
        agent: 'assistant',
        parts: [{ type: 'text', text: contextPrompt }],
      },
    });

    logger.info('Scheduler', 'TASK.md execution completed');
  } catch (err) {
    logger.error('Scheduler', 'Failed to execute TASK:', err);
  }
}

/**
 * Execute CRON.md user scheduled task
 */
async function executeCronTask(
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

    await client.session.prompt({
      path: { id: sessionId },
      body: {
        agent: 'assistant',
        parts: [{ type: 'text', text: contextPrompt }],
      },
    });

    logger.info('Scheduler', 'CRON task completed:', task.name);
  } catch (err) {
    logger.error('Scheduler', 'Failed to execute CRON task:', err);
  }
}

/**
 * Execute CRON_SYS.md system task in a separate cron sys session
 */
async function executeCronSysTask(
  projectDir: string,
  client: any,
  task: CronTask,
  fullCronSysContent: string
): Promise<void> {
  try {
    ensureMemoryPaths(projectDir);
    
    logger.info('Scheduler', 'Executing CRON_SYS task:', task.name);

    const taskType = detectCompressionType(task.name);
    if (!taskType) {
      logger.warn('Scheduler', 'Unknown CRON_SYS task type:', task.name);
      return;
    }

    const compressionPrompt = buildCompressionPrompt(projectDir, taskType, 'cron_sys');
    const sessionManager = new CronSysSessionManager(client);
    const sessionId = await sessionManager.createSession();

    if (!sessionId) {
      logger.error('Scheduler', 'Failed to create cron sys session');
      return;
    }

    const result = await client.session.prompt({
      path: { id: sessionId },
      body: {
        agent: 'assistant',
        parts: [{ type: 'text', text: compressionPrompt }],
      },
    });

    const response = (result as any)?.data;
    const parts = response?.parts || [];
    const textParts = parts.filter((p: any) => p.type === 'text');
    const responseText = textParts.map((p: any) => p.text).join('\n');

    const summary = extractSummary(responseText);
    if (!summary) {
      logger.error('Scheduler', 'No <summary> tag found in agent response');
      return;
    }

    const targetPath = taskType === 'L1' ? getL1Path(projectDir) : getL2Path(projectDir);
    writeFileSync(targetPath, summary, 'utf-8');
    logger.info('Scheduler', 'CRON_SYS task completed:', task.name, '→', targetPath);
  } catch (err) {
    logger.error('Scheduler', 'Failed to execute CRON_SYS task:', err);
  }
}

/**
 * Execute per-session TASK.md
 */
async function executeSessionTask(
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

    await client.session.prompt({
      path: { id: sessionId },
      body: {
        agent: 'assistant',
        parts: [{ type: 'text', text: contextPrompt }],
      },
    });

    logger.info('Scheduler', 'Session TASK.md execution completed for:', chatId);
  } catch (err) {
    logger.error('Scheduler', 'Failed to execute session TASK:', err);
  }
}

/**
 * Execute per-session CRON.md task
 */
async function executeSessionCronTask(
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

    await client.session.prompt({
      path: { id: sessionId },
      body: {
        agent: 'assistant',
        parts: [{ type: 'text', text: contextPrompt }],
      },
    });

    logger.info('Scheduler', 'Session CRON task completed:', task.name, 'for:', chatId);
  } catch (err) {
    logger.error('Scheduler', 'Failed to execute session CRON task:', err);
  }
}

/**
 * Execute per-session CRON_SYS.md task with per-session L1/L2 paths
 */
async function executeSessionCronSysTask(
  projectDir: string,
  client: any,
  task: CronTask,
  fullCronSysContent: string,
  chatId: string
): Promise<void> {
  try {
    const sessionDir = dirname(getSessionL9FilePath(projectDir, chatId, 'TASK.md'));
    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true });
    }

    logger.info('Scheduler', 'Executing session CRON_SYS task:', task.name, 'for:', chatId);

    const taskType = detectCompressionType(task.name);
    if (!taskType) {
      logger.warn('Scheduler', 'Unknown CRON_SYS task type:', task.name);
      return;
    }

    const compressionPrompt = buildCompressionPrompt(projectDir, taskType, chatId);
    const sessionManager = new CronSysSessionManager(client);
    const sessionId = await sessionManager.createSession();

    if (!sessionId) {
      logger.error('Scheduler', 'Failed to create cron sys session');
      return;
    }

    const result = await client.session.prompt({
      path: { id: sessionId },
      body: {
        agent: 'assistant',
        parts: [{ type: 'text', text: compressionPrompt }],
      },
    });

    const response = (result as any)?.data;
    const parts = response?.parts || [];
    const textParts = parts.filter((p: any) => p.type === 'text');
    const responseText = textParts.map((p: any) => p.text).join('\n');

    const summary = extractSummary(responseText);
    if (!summary) {
      logger.error('Scheduler', 'No <summary> tag found in agent response');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const weekStart = getWeekStart(new Date());
    const targetPath = taskType === 'L1' 
      ? getSessionL1FilePath(projectDir, chatId, today)
      : getSessionL2FilePath(projectDir, chatId, weekStart);
    
    const targetDir = dirname(targetPath);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    
    writeFileSync(targetPath, summary, 'utf-8');
    logger.info('Scheduler', 'Session CRON_SYS task completed:', task.name, '→', targetPath);
  } catch (err) {
    logger.error('Scheduler', 'Failed to execute session CRON_SYS task:', err);
  }
}

/**
 * Get week start date (Monday) for a given date
 */
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Detect compression type from task name
 */
function detectCompressionType(taskName: string): 'L1' | 'L2' | null {
  if (taskName.includes('L1') || taskName.toLowerCase().includes('daily')) {
    return 'L1';
  }
  if (taskName.includes('L2') || taskName.toLowerCase().includes('weekly')) {
    return 'L2';
  }
  return null;
}

/**
 * Extract single task content from full cron file content
 */
function extractTaskContent(fullContent: string, taskName: string): string {
  const sections = fullContent.split(/^# /m);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    const lines = section.split('\n');
    const title = lines[0].trim();
    
    if (title === taskName) {
      return section;
    }
    
    for (let line of lines.slice(1)) {
      let trimmed = line.trim();
      if (trimmed.startsWith('* ')) {
        trimmed = trimmed.substring(2);
      }
      if (trimmed.startsWith('name:') && trimmed.substring(5).trim() === taskName) {
        return section;
      }
    }
  }
  
  return '';
}

/**
 * Check if any tasks should run now (legacy function)
 */
function checkAndRun(
  projectDir: string,
  callback: (tasks: CronTask[]) => void
): void {
  const now = new Date();

  const minute = now.getMinutes();
  if (minute !== 0 && minute !== 30) {
    return;
  }

  const cronContent = readCron(projectDir);
  const cronSysContent = readCronSys(projectDir);

  const userTasks = parseCronFile(cronContent);
  const systemTasks = parseCronFile(cronSysContent);

  const enabledUserTasks = userTasks.filter((t) => t.enabled);
  const enabledSystemTasks = systemTasks.filter((t) => t.enabled);

  const activeUserTasks = getActiveTasks(enabledUserTasks, now);
  const activeSystemTasks = getActiveTasks(enabledSystemTasks, now);

  const allActiveTasks = [...activeUserTasks, ...activeSystemTasks];

  if (allActiveTasks.length > 0) {
    callback(allActiveTasks);
  }
}

/**
 * Get the next scheduled trigger time
 */
export function getNextScheduledTime(): Date {
  const now = new Date();
  const minute = now.getMinutes();

  if (minute === 0 || minute === 30) {
    return new Date(now.getTime() + 30 * 60 * 1000);
  }

  const next = new Date(now);
  if (minute < 30) {
    next.setMinutes(30, 0, 0);
  } else {
    next.setHours(next.getHours() + 1);
    next.setMinutes(0, 0, 0);
  }

  return next;
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return isRunning;
}

export async function testTriggerAllCron(
  projectDir: string,
  client: any
): Promise<void> {
  const cronContent = readCron(projectDir);
  const userTasks = parseCronFile(cronContent);
  const enabledUserTasks = userTasks.filter((t) => t.enabled);
  
  for (const task of enabledUserTasks) {
    await executeCronTask(projectDir, client, task, cronContent);
  }
}

export async function testTriggerAllCronSys(
  projectDir: string,
  client: any
): Promise<void> {
  const cronSysContent = readCronSys(projectDir);
  const systemTasks = parseCronFile(cronSysContent);
  const enabledSystemTasks = systemTasks.filter((t) => t.enabled);
  
  for (const task of enabledSystemTasks) {
    await executeCronSysTask(projectDir, client, task, cronSysContent);
  }
}
