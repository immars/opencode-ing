import { readCron, readCronSys } from '../memory/levels.js';
import { getActiveTasksFromContent } from './utils.js';
import { executeScheduledTasks } from './executor.js';
import type { CronTask } from '../memory/types.js';

/** Scheduler interval timer */
let schedulerInterval: NodeJS.Timeout | null = null;

/** Scheduler running flag */
let schedulerRunning = false;

/** Scheduler client reference */
let schedulerClient: any = null;

/** Scheduler project directory */
let schedulerProjectDir: string = '';

export function isSchedulerRunning(): boolean {
  return schedulerRunning;
}

export function setSchedulerRunning(running: boolean): void {
  schedulerRunning = running;
}

export function getSchedulerClient(): any {
  return schedulerClient;
}

export function setSchedulerClient(client: any): void {
  schedulerClient = client;
}

export function getSchedulerProjectDir(): string {
  return schedulerProjectDir;
}

export function setSchedulerProjectDir(dir: string): void {
  schedulerProjectDir = dir;
}

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

  const allActiveTasks = [
    ...getActiveTasksFromContent(cronContent, now),
    ...getActiveTasksFromContent(cronSysContent, now)
  ];

  if (allActiveTasks.length > 0) {
    callback(allActiveTasks);
  }
}

export function startScheduler(
  projectDir: string,
  callback: (tasks: CronTask[]) => void
): void {
  if (isSchedulerRunning()) {
    return;
  }

  setSchedulerRunning(true);

  checkAndRun(projectDir, callback);

  const interval = setInterval(() => {
    checkAndRun(projectDir, callback);
  }, 60 * 1000);
  schedulerInterval = interval;
}

export function startSchedulerWithAgent(
  projectDir: string,
  client: any
): void {
  if (isSchedulerRunning()) {
    return;
  }

  setSchedulerRunning(true);
  setSchedulerClient(client);
  setSchedulerProjectDir(projectDir);

  executeScheduledTasks(projectDir, client);

  const interval = setInterval(() => {
    executeScheduledTasks(projectDir, client);
  }, 60 * 1000);
  schedulerInterval = interval;
}

export function stopScheduler(): void {
  const interval = schedulerInterval;
  if (interval) {
    clearInterval(interval);
    schedulerInterval = null;
  }
  setSchedulerRunning(false);
  setSchedulerClient(null);
  setSchedulerProjectDir('');
}

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
