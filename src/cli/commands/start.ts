import path from 'node:path';
import { spawnAgent, getSessionPid, getAgentByPath, type SpawnResult, type AgentType } from '../process.js';

export interface StartCommandOptions {
  targetPath: string;
  agentType: AgentType;
}

export async function startCommand(targetPath: string, agentType: AgentType): Promise<void> {
  const absolutePath = path.resolve(targetPath);
  console.log(`[Start] Starting ${agentType} agent at: ${absolutePath}`);

  const existingAgent = getAgentByPath(absolutePath);
  if (existingAgent) {
    console.log(`[Start] Agent already running at ${absolutePath}`);
    console.log(`[Start] tmux session: ${existingAgent.tmuxSession}`);
    console.log(`[Start] To attach: tmux attach -t ${existingAgent.tmuxSession}`);
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

  console.log('');
  console.log('========================================');
  console.log('Agent started successfully!');
  console.log('========================================');
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
