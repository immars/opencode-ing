import path from 'node:path';
import { spawnAgent, getSessionPid, type SpawnResult } from '../process.js';
import { ACPClient } from '../acp/client.js';
import { registerAgent, listAgents, syncWithTmux } from '../registry.js';
import type { AgentInfo } from '../registry.js';

export type AgentType = 'opencode' | 'claude-code';

export interface StartCommandOptions {
  targetPath: string;
  agentType: AgentType;
}

export async function startCommand(targetPath: string, agentType: AgentType): Promise<void> {
  syncWithTmux();
  const absolutePath = path.resolve(targetPath);
  console.log(`[Start] Starting ${agentType} agent at: ${absolutePath}`);

  const existingAgents = listAgents({ status: 'running' });
  const duplicateAgent = existingAgents.find((agent: AgentInfo) => agent.path === absolutePath);

  if (duplicateAgent) {
    console.log(`[Start] Agent already registered at ${absolutePath}`);
    console.log(`[Start] tmux session: ${duplicateAgent.tmuxSession}`);
    console.log(`[Start] To attach: tmux attach -t ${duplicateAgent.tmuxSession}`);
    return;
  }

  let command: string;
  let args: string[];

  if (agentType === 'opencode') {
    command = 'opencode';
    args = ['acp'];
  } else if (agentType === 'claude-code') {
    command = 'claude';
    args = ['code', '--agent'];
  } else {
    throw new Error(`Unknown agent type: ${agentType}`);
  }

  console.log(`[Start] Spawning: ${command} ${args.join(' ')}`);

  const spawnResult = spawnAgent(command, args, absolutePath);
  if (!spawnResult) {
    throw new Error(`Failed to spawn ${agentType} agent in tmux session`);
  }

  const { sessionName: tmuxSession, isNew } = spawnResult;

  if (!isNew) {
    console.log(`[Start] Reusing existing tmux session: ${tmuxSession}`);
    console.log(`[Start] To attach: tmux attach -t ${tmuxSession}`);
    return;
  }

  console.log(`[Start] Agent running in tmux session: ${tmuxSession}`);

  const pid = getSessionPid(tmuxSession);

  const client = new ACPClient(command, args);

  try {
    console.log('[Start] Initializing ACP connection...');
    await client.initialize();
    console.log('[Start] ACP connection initialized');
  } catch (error) {
    console.error('[Start] Failed to initialize ACP connection:', error);
    throw new Error('ACP initialization failed');
  }

  let sessionId: string;
  try {
    console.log('[Start] Creating new session...');
    const sessionResponse = await client.sessionNew(absolutePath, []);
    sessionId = sessionResponse.sessionId;
    console.log(`[Start] Session created: ${sessionId}`);
  } catch (error) {
    console.error('[Start] Failed to create session:', error);
    client.close();
    throw new Error('Session creation failed');
  }

  const agentInfo: AgentInfo = {
    type: agentType,
    path: absolutePath,
    pid: pid,
    sessionId,
    tmuxSession,
    startedAt: new Date().toISOString(),
    status: 'running',
  };

  const registered = registerAgent(sessionId, agentInfo);
  if (!registered) {
    console.error('[Start] Warning: Failed to register agent in registry');
  }

  console.log('');
  console.log('========================================');
  console.log('Agent started successfully!');
  console.log('========================================');
  console.log(`Session ID: ${sessionId}`);
  console.log(`tmux Session: ${tmuxSession}`);
  console.log(`PID: ${pid ?? 'N/A'}`);
  console.log(`Type: ${agentType}`);
  console.log(`Working Directory: ${absolutePath}`);
  console.log('');
  console.log('To attach: tmux attach -t ' + tmuxSession);
  console.log('========================================');
  console.log('');
}

export default startCommand;
