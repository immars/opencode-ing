/**
 * Start Command
 *
 * Starts an external coding agent with ACP protocol support.
 */

import path from 'node:path';
import { spawnAgent } from '../process.js';
import { ACPClient } from '../acp/client.js';
import { registerAgent, listAgents } from '../registry.js';
import type { AgentInfo } from '../registry.js';

export type AgentType = 'opencode' | 'claude-code';

export interface StartCommandOptions {
  targetPath: string;
  agentType: AgentType;
}

/**
 * Start an agent at the specified path
 */
export async function startCommand(targetPath: string, agentType: AgentType): Promise<void> {
  // 1. Resolve absolute path
  const absolutePath = path.resolve(targetPath);
  console.log(`[Start] Starting ${agentType} agent at: ${absolutePath}`);

  // 2. Check if agent already running at this path
  const existingAgents = listAgents({ status: 'running' });
  const duplicateAgent = existingAgents.find((agent: AgentInfo) => agent.path === absolutePath);

  if (duplicateAgent) {
    console.error(`[Start] Agent already running at ${absolutePath}`);
    console.error(`[Start] Session ID: ${duplicateAgent.sessionId}, PID: ${duplicateAgent.pid}`);
    throw new Error(`Agent already running at ${absolutePath}`);
  }

  // 3. Spawn the agent process
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
  const childProcess = spawnAgent(command, args, absolutePath);

  if (!childProcess.pid) {
    throw new Error('Failed to spawn agent process');
  }

  console.log(`[Start] Agent process spawned with PID: ${childProcess.pid}`);

  // 4. Create ACPClient and initialize
  const client = new ACPClient(command, args);

  try {
    console.log('[Start] Initializing ACP connection...');
    await client.initialize();
    console.log('[Start] ACP connection initialized');
  } catch (error) {
    console.error('[Start] Failed to initialize ACP connection:', error);
    childProcess.kill();
    throw new Error('ACP initialization failed');
  }

  // 5. Create new session
  let sessionId: string;
  try {
    console.log('[Start] Creating new session...');
    const sessionResponse = await client.sessionNew(absolutePath);
    sessionId = sessionResponse.sessionId;
    console.log(`[Start] Session created: ${sessionId}`);
  } catch (error) {
    console.error('[Start] Failed to create session:', error);
    client.close();
    childProcess.kill();
    throw new Error('Session creation failed');
  }

  // 6. Register agent in registry
  const agentInfo: AgentInfo = {
    type: agentType,
    path: absolutePath,
    pid: childProcess.pid,
    sessionId,
    startedAt: new Date().toISOString(),
    status: 'running',
  };

  const registered = registerAgent(sessionId, agentInfo);
  if (!registered) {
    console.error('[Start] Warning: Failed to register agent in registry');
  }

  // 7. Output success message
  console.log('');
  console.log('========================================');
  console.log('Agent started successfully!');
  console.log('========================================');
  console.log(`Session ID: ${sessionId}`);
  console.log(`PID: ${childProcess.pid}`);
  console.log(`Type: ${agentType}`);
  console.log(`Working Directory: ${absolutePath}`);
  console.log('========================================');
  console.log('');
}

/**
 * Export for use in CLI entry point
 */
export default startCommand;
