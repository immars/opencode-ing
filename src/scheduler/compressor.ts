import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { logger } from '../logger.js';
import { parseCronFile } from '../memory/cron.js';
import type { CronTask } from '../memory/types.js';
import { 
  buildCompressionPrompt,
  extractSummary,
  getL1Path,
  getL2Path
} from '../memory/context.js';
import { CronSysSessionManager } from '../memory/session.js';
import { listAllSessions, getSessionL9FilePath, getSessionL1FilePath, getSessionL2FilePath } from '../memory/paths.js';
import { executeAgentPrompt } from './utils.js';

/**
 * Get week start date (Monday) for a given date
 */
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Detect compression type from task name
 */
export function detectCompressionType(taskName: string): 'L1' | 'L2' | null {
  if (taskName.includes('L1') || taskName.toLowerCase().includes('daily')) {
    return 'L1';
  }
  if (taskName.includes('L2') || taskName.toLowerCase().includes('weekly')) {
    return 'L2';
  }
  return null;
}

export async function executeCompressionPrompt(
  client: any,
  sessionId: string,
  compressionPrompt: string
): Promise<string | null> {
  const result = await executeAgentPrompt(client, sessionId, compressionPrompt);
  const response = (result as any)?.data;
  const parts = response?.parts || [];
  const textParts = parts.filter((p: any) => p.type === 'text');
  const responseText = textParts.map((p: any) => p.text).join('\n');

  return extractSummary(responseText);
}

export async function compressSession(
  projectDir: string,
  client: any,
  sessionManager: CronSysSessionManager,
  taskType: 'L1' | 'L2',
  chatId: string
): Promise<void> {
  const compressionPrompt = buildCompressionPrompt(projectDir, taskType, chatId);
  const sessionId = await sessionManager.createSession();

  if (!sessionId) {
    logger.error('Scheduler', 'Failed to create cron sys session for:', chatId);
    return;
  }

  try {
    const summary = await executeCompressionPrompt(client, sessionId, compressionPrompt);
    if (!summary) {
      logger.error('Scheduler', 'No <summary> tag found for session:', chatId);
      return;
    }

    const targetPath = taskType === 'L1' ? getL1Path(projectDir, chatId) : getL2Path(projectDir, chatId);
    const targetDir = dirname(targetPath);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    
    writeFileSync(targetPath, summary, 'utf-8');
    logger.info('Scheduler', `Session ${chatId} compressed →`, targetPath);
  } catch (err) {
    logger.error('Scheduler', 'Failed to compress session:', chatId, err);
  }
}

export async function executeCronSysTask(
  projectDir: string,
  client: any,
  task: CronTask,
  fullCronSysContent: string
): Promise<void> {
  try {
    logger.info('Scheduler', 'Executing CRON_SYS task:', task.name);

    const taskType = detectCompressionType(task.name);
    if (!taskType) {
      logger.warn('Scheduler', 'Unknown CRON_SYS task type:', task.name);
      return;
    }

    const sessions = listAllSessions(projectDir);
    if (sessions.length === 0) {
      logger.info('Scheduler', 'No sessions found for compression');
      return;
    }

    const sessionManager = new CronSysSessionManager(client);

    for (const chatId of sessions) {
      await compressSession(projectDir, client, sessionManager, taskType, chatId);
    }
  } catch (err) {
    logger.error('Scheduler', 'Failed to execute CRON_SYS task:', err);
  }
}

/**
 * Execute per-session CRON_SYS.md task with per-session L1/L2 paths
 */
export async function executeSessionCronSysTask(
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

    const summary = await executeCompressionPrompt(client, sessionId, compressionPrompt);
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

export async function testTriggerAllCronSys(
  projectDir: string,
  client: any,
  readCronSys: (dir: string) => string
): Promise<void> {
  const cronSysContent = readCronSys(projectDir);
  const systemTasks = parseCronFile(cronSysContent);
  const enabledSystemTasks = systemTasks.filter((t: CronTask) => t.enabled);
  
  for (const task of enabledSystemTasks) {
    await executeCronSysTask(projectDir, client, task, cronSysContent);
  }
}
