/**
 * Scheduler - Timer Trigger Engine
 *
 * Triggers at xx:00 and xx:30 every hour
 * Executes TASK.md, CRON.md, and CRON_SYS.md tasks by prompting the agent
 */

import { parseCronFile, getActiveTasks } from './memory/cron.js';
import type { CronTask } from './memory/types.js';
import { readCron, readCronSys, readTasks } from './memory/l9.js';
import { getTaskContext, getCronContext, getCronSysContext } from './memory/context.js';
import { CronSysSessionManager } from './memory/session.js';

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

  console.error('[Scheduler] Triggered at', now.toISOString());

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
}

/**
 * Execute TASK.md user task
 */
async function executeTask(
  projectDir: string,
  client: any
): Promise<void> {
  try {
    console.error('[Scheduler] Executing TASK.md');

    const contextPrompt = getTaskContext(projectDir);

    const sessionsResp = await client.session.list();
    const allSessions = sessionsResp?.data || [];

    const managedSessions = allSessions.filter((s: any) => 
      s.title === 'Assistant Managed Session'
    );

    let sessionId: string | null;
    if (managedSessions.length > 0) {
      sessionId = managedSessions[0].id;
    } else {
      const newSession = await client.session.create({
        body: { title: 'Assistant Managed Session' },
      });
      sessionId = newSession.data?.id;
    }

    if (!sessionId) {
      console.error('[Scheduler] Failed to get or create session for TASK execution');
      return;
    }

    await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: 'text', text: contextPrompt }],
      },
    });

    console.error('[Scheduler] TASK.md execution completed');
  } catch (err) {
    console.error('[Scheduler] Failed to execute TASK:', err);
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
    console.error('[Scheduler] Executing CRON task:', task.name);

    const taskContent = extractTaskContent(fullCronContent, task.name);
    const contextPrompt = getCronContext(projectDir, taskContent);

    const sessionsResp = await client.session.list();
    const allSessions = sessionsResp?.data || [];

    const managedSessions = allSessions.filter((s: any) => 
      s.title === 'Assistant Managed Session'
    );

    let sessionId: string | null;
    if (managedSessions.length > 0) {
      sessionId = managedSessions[0].id;
    } else {
      const newSession = await client.session.create({
        body: { title: 'Assistant Managed Session' },
      });
      sessionId = newSession.data?.id;
    }

    if (!sessionId) {
      console.error('[Scheduler] Failed to get or create session for CRON execution');
      return;
    }

    await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: 'text', text: contextPrompt }],
      },
    });

    console.error('[Scheduler] CRON task completed:', task.name);
  } catch (err) {
    console.error('[Scheduler] Failed to execute CRON task:', err);
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
    console.error('[Scheduler] Executing CRON_SYS task:', task.name);

    const taskContent = extractTaskContent(fullCronSysContent, task.name);
    const contextPrompt = getCronSysContext(projectDir, taskContent);

    const sessionManager = new CronSysSessionManager(client);
    const sessionId = await sessionManager.createSession();

    if (!sessionId) {
      console.error('[Scheduler] Failed to create cron sys session');
      return;
    }

    await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: 'text', text: contextPrompt }],
      },
    });

    console.error('[Scheduler] CRON_SYS task completed:', task.name);
  } catch (err) {
    console.error('[Scheduler] Failed to execute CRON_SYS task:', err);
  }
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
    
    for (const line of lines.slice(1)) {
      if (line.trim().startsWith('name:') && line.trim().substring(5).trim() === taskName) {
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
