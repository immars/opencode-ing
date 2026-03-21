/**
 * Process Management Utilities
 *
 * Provides tmux-based session management for agent execution.
 * Uses tmux sessions to manage agent processes for better persistence
 * and cross-terminal support.
 */

import { spawnSync } from 'node:child_process';

export interface ProcessInfo {
  tmuxSession: string;
  isRunning: boolean;
  command: string;
  args: string[];
}

const GRACEFUL_SHUTDOWN_TIMEOUT = 5000;

export function generateSessionName(targetPath: string): string {
  const safePath = targetPath
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\//g, '-');
  return `code-ing-${safePath}`;
}

/**
 * Run a tmux command and return the result
 */
function runTmux(args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('tmux', args, {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status ?? 1,
  };
}

/**
 * Check if tmux is available on the system
 */
export function isTmuxAvailable(): boolean {
  const result = spawnSync('which', ['tmux'], { encoding: 'utf-8' });
  return result.status === 0;
}

export interface SpawnResult {
  sessionName: string;
  isNew: boolean;
}

export function spawnAgent(
  command: string,
  args: string[],
  cwd: string,
  sessionName?: string
): SpawnResult | null {
  if (!isTmuxAvailable()) {
    console.error('[Process] tmux is not available on this system');
    return null;
  }

  const tmuxSession = sessionName || generateSessionName(cwd);

  if (hasTmuxSession(tmuxSession)) {
    console.log(`[Process] tmux session already exists: ${tmuxSession}, reusing`);
    return { sessionName: tmuxSession, isNew: false };
  }

  const fullCommand = `${command} ${args.join(' ')}`;

  const tmuxArgs = [
    'new-session',
    '-d',
    '-s', tmuxSession,
    '-c', cwd,
    '--', command,
    ...args,
  ];

  console.log(`[Process] Creating tmux session: ${tmuxSession}`);
  console.log(`[Process] Command: ${fullCommand}`);
  console.log(`[Process] Working directory: ${cwd}`);

  const result = runTmux(tmuxArgs);

  if (result.status !== 0) {
    console.error(`[Process] Failed to create tmux session: ${result.stderr}`);
    return null;
  }

  console.log(`[Process] tmux session created: ${tmuxSession}`);
  return { sessionName: tmuxSession, isNew: true };
}

/**
 * Check if a tmux session exists
 */
export function hasTmuxSession(sessionName: string): boolean {
  const result = runTmux(['has-session', '-t', sessionName]);
  return result.status === 0;
}

/**
 * Kill a tmux session
 */
export function killTmuxSession(sessionName: string): boolean {
  if (!hasTmuxSession(sessionName)) {
    return false;
  }

  // Send SIGTERM first for graceful shutdown
  runTmux(['send-keys', '-t', sessionName, 'C-c']);

  // Wait a bit for graceful shutdown
  const startTime = Date.now();
  while (Date.now() - startTime < 2000) {
    if (!hasTmuxSession(sessionName)) {
      return true;
    }
    // Brief sleep
    const spinStart = Date.now();
    while (Date.now() - spinStart < 100) { }
  }

  // Force kill the session
  const result = runTmux(['kill-session', '-t', sessionName]);
  return result.status === 0;
}

/**
 * Kill process by PID (kept for backward compatibility)
 */
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

/**
 * Check if a process is running by PID
 */
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

/**
 * Check if an agent session is running (by tmux session name)
 */
export function isSessionRunning(sessionName: string): boolean {
  return hasTmuxSession(sessionName);
}

/**
 * Get the PID of the main process in a tmux session
 */
export function getSessionPid(sessionName: string): number | null {
  if (!hasTmuxSession(sessionName)) {
    return null;
  }

  // Get the pane PID
  const result = runTmux(['display-message', '-p', '-t', sessionName, '#{pane_pid}']);
  if (result.status !== 0) {
    return null;
  }

  const pid = parseInt(result.stdout.trim(), 10);
  return isNaN(pid) ? null : pid;
}

/**
 * Get process info (kept for backward compatibility)
 */
export function getProcessInfo(pid: number): ProcessInfo | null {
  if (!isProcessRunning(pid)) {
    return null;
  }

  return {
    tmuxSession: '',
    isRunning: true,
    command: '',
    args: [],
  };
}

/**
 * Get tmux session info
 */
export function getSessionInfo(sessionName: string): ProcessInfo | null {
  if (!hasTmuxSession(sessionName)) {
    return null;
  }

  return {
    tmuxSession: sessionName,
    isRunning: true,
    command: '',
    args: [],
  };
}

/**
 * List all code-ing tmux sessions
 */
export function listCodeIngSessions(): string[] {
  const result = runTmux(['list-sessions', '-F', '#{session_name}']);
  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .trim()
    .split('\n')
    .filter((name) => name.startsWith('code-ing-'));
}

/**
 * Attach to a tmux session (for interactive use)
 * Note: This will block until the user detaches
 */
export function attachToSession(sessionName: string): boolean {
  if (!hasTmuxSession(sessionName)) {
    return false;
  }

  // This is meant to be called interactively
  const result = spawnSync('tmux', ['attach', '-t', sessionName], {
    stdio: 'inherit',
  });

  return result.status === 0;
}

/**
 * Get session output (last N lines)
 */
export function getSessionOutput(sessionName: string, lines: number = 50): string {
  if (!hasTmuxSession(sessionName)) {
    return '';
  }

  const result = runTmux(['capture-pane', '-t', sessionName, '-p', '-S', `-${lines}`]);
  return result.stdout;
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
