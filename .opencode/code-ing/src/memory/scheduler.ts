/**
 * Scheduler - Timer Trigger Engine
 *
 * Triggers at xx:00 and xx:30 every hour
 */

import { parseCronFile, getActiveTasks } from './cron.js';
import type { CronTask } from './types.js';
import { readCron, readCronSys } from './l9.js';

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Start the scheduler with callback
 */
export function startScheduler(
  projectDir: string,
  callback: (tasks: CronTask[]) => void
): void {
  if (isRunning) {
    return;
  }

  isRunning = true;

  // Check immediately on start
  checkAndRun(projectDir, callback);

  // Then check every minute
  schedulerInterval = setInterval(() => {
    checkAndRun(projectDir, callback);
  }, 60 * 1000); // Check every minute
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
}

/**
 * Check if any tasks should run now
 */
function checkAndRun(
  projectDir: string,
  callback: (tasks: CronTask[]) => void
): void {
  const now = new Date();

  // Only trigger at xx:00 and xx:30
  const minute = now.getMinutes();
  if (minute !== 0 && minute !== 30) {
    return;
  }

  // Read cron files
  const cronContent = readCron(projectDir);
  const cronSysContent = readCronSys(projectDir);

  // Parse tasks
  const userTasks = parseCronFile(cronContent);
  const systemTasks = parseCronFile(cronSysContent);

  // Filter to only enabled tasks
  const enabledUserTasks = userTasks.filter((t) => t.enabled);
  const enabledSystemTasks = systemTasks.filter((t) => t.enabled);

  // Get active tasks
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

  // If we're at xx:00 or xx:30, the next is in 30 minutes
  if (minute === 0 || minute === 30) {
    return new Date(now.getTime() + 30 * 60 * 1000);
  }

  // Otherwise, find the next xx:00 or xx:30
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
