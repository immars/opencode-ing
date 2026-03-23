/**
 * Process Management Utilities
 *
 * Provides tmux-based session management for agent execution.
 * Uses tmux sessions to manage agent processes for better persistence
 * and cross-terminal support.
 * 
 * tmux is the SINGLE SOURCE OF TRUTH for agent state.
 * No local file persistence is used.
 */

import { spawnSync } from 'node:child_process';

export type AgentType = 'opencode' | 'claude-code';

export interface ProcessInfo {
  tmuxSession: string;
  isRunning: boolean;
  command: string;
  args: string[];
}

export interface AgentSessionInfo {
  tmuxSession: string;
  path: string;
  pid: number | null;
  type: AgentType;
  startedAt: string | null;
}

const GRACEFUL_SHUTDOWN_TIMEOUT = 5000;

const SESSION_PREFIX = 'code-ing-';

export function generateSessionName(targetPath: string): string {
  const safePath = targetPath
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\//g, '-');
  return `${SESSION_PREFIX}${safePath}`;
}

export function pathFromSessionName(sessionName: string): string | null {
  if (!sessionName.startsWith(SESSION_PREFIX)) {
    return null;
  }
  const safePath = sessionName.slice(SESSION_PREFIX.length);
  return '/' + safePath.replace(/-/g, '/');
}

export function getAgentTypeFromSession(sessionName: string): AgentType | null {
  if (!hasTmuxSession(sessionName)) {
    return null;
  }

  const result = runTmux(['list-panes', '-t', sessionName, '-F', '#{pane_current_command}']);
  if (result.status !== 0) {
    return null;
  }

  const command = result.stdout.trim();
  if (command === 'opencode' || command.includes('opencode')) {
    return 'opencode';
  }
  if (command === 'claude' || command.includes('claude')) {
    return 'claude-code';
  }
  
  return null;
}

export function getSessionCreatedTime(sessionName: string): string | null {
  if (!hasTmuxSession(sessionName)) {
    return null;
  }

  const result = runTmux(['display-message', '-t', sessionName, '-p', '#{session_created}']);
  if (result.status !== 0) {
    return null;
  }

  const timestamp = parseInt(result.stdout.trim(), 10);
  if (isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

export function sendToSession(sessionName: string, input: string): boolean {
  if (!hasTmuxSession(sessionName)) {
    return false;
  }

  const result = runTmux(['send-keys', '-t', sessionName, input, 'Enter']);
  return result.status === 0;
}

export function sendRawToSession(sessionName: string, input: string): boolean {
  if (!hasTmuxSession(sessionName)) {
    return false;
  }

  const result = runTmux(['send-keys', '-t', sessionName, '-l', input]);
  return result.status === 0;
}

export function waitForSessionOutput(
  sessionName: string,
  expectedPattern: RegExp,
  timeoutMs: number = 5000
): string | null {
  if (!hasTmuxSession(sessionName)) {
    return null;
  }

  const startTime = Date.now();
  let lastOutput = '';

  while (Date.now() - startTime < timeoutMs) {
    const output = getSessionOutput(sessionName, 100);
    if (expectedPattern.test(output)) {
      const newContent = output.slice(lastOutput.length);
      return newContent;
    }
    lastOutput = output;
    
    const spinStart = Date.now();
    while (Date.now() - spinStart < 100) { }
  }

  return null;
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
    .filter((name) => name.startsWith(SESSION_PREFIX));
}

export function listAllAgents(): AgentSessionInfo[] {
  const sessions = listCodeIngSessions();
  const agents: AgentSessionInfo[] = [];

  for (const sessionName of sessions) {
    const path = pathFromSessionName(sessionName);
    if (!path) continue;

    const pid = getSessionPid(sessionName);
    const type = getAgentTypeFromSession(sessionName);
    const startedAt = getSessionCreatedTime(sessionName);

    agents.push({
      tmuxSession: sessionName,
      path,
      pid,
      type: type || 'opencode',
      startedAt,
    });
  }

  return agents;
}

export function getAgentByPath(targetPath: string): AgentSessionInfo | null {
  const sessionName = generateSessionName(targetPath);
  
  if (!hasTmuxSession(sessionName)) {
    return null;
  }

  const pid = getSessionPid(sessionName);
  const type = getAgentTypeFromSession(sessionName);
  const startedAt = getSessionCreatedTime(sessionName);

  return {
    tmuxSession: sessionName,
    path: targetPath,
    pid,
    type: type || 'opencode',
    startedAt,
  };
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
