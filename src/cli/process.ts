/**
 * Process Management Utilities
 *
 * Provides child process spawning and management utilities for agent execution.
 */

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

export interface ProcessInfo {
  pid: number;
  uptime: number;
  isRunning: boolean;
  command: string;
  args: string[];
}

const GRACEFUL_SHUTDOWN_TIMEOUT = 5000;

export function spawnAgent(
  command: string,
  args: string[],
  cwd: string
): ChildProcess {
  const child = spawn(command, args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  
  // Handle spawn failure (command not found etc.)
  child.on('error', () => { /* error logged elsewhere */ });
  
  return child;
}

export function killProcess(pid: number, signal: NodeJS.Signals = 'SIGTERM'): boolean {
  try {
    if (!isProcessRunning(pid)) {
      return false;
    }
    process.kill(pid, signal);

    const timeout = Date.now() + 5000;
    while (Date.now() < timeout) {
      if (!isProcessRunning(pid)) {
        return true;
      }
      const start = Date.now();
      while (Date.now() - start < 200) { }
    }

    try {
      process.kill(pid, 'SIGKILL');
    } catch { }
    return !isProcessRunning(pid);
  } catch (e: any) {
    if (e.code === 'EPERM') {
      console.error('[Process] EPERM: Process exists but cannot be killed:', pid);
      return false;
    }
    if (e.code === 'ESRCH') {
      return false;
    }
    console.error('[Process] Failed to kill process:', pid, e);
    return false;
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e: any) {
    if (e.code === 'EPERM') {
      return true;
    }
    return false;
  }
}

export function getProcessInfo(pid: number): ProcessInfo | null {
  if (!isProcessRunning(pid)) {
    return null;
  }

  return {
    pid,
    uptime: 0,
    isRunning: true,
    command: '',
    args: [],
  };
}

export async function gracefulKillProcess(pid: number): Promise<boolean> {
  const sigtermSent = killProcess(pid, 'SIGTERM');
  if (!sigtermSent) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      const sigkillSent = killProcess(pid, 'SIGKILL');
      if (sigkillSent) {
        setTimeout(() => {
          resolve(!isProcessRunning(pid));
        }, 100);
      } else {
        resolve(false);
      }
    }, GRACEFUL_SHUTDOWN_TIMEOUT);

    const interval = setInterval(() => {
      if (!isProcessRunning(pid)) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve(true);
      }
    }, 100);
  });
}
