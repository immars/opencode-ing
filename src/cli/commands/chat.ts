import path from 'node:path';
import { listAgents, syncWithTmux, type AgentInfo } from '../registry.js';
import { ACPClient } from '../acp/client.js';
import type { ContentBlock } from '../acp/types.js';

export interface ChatCommandOptions {
  targetPath: string;
  message: string;
}

export async function chatCommand(targetPath: string, message: string): Promise<void> {
  syncWithTmux();
  const absolutePath = path.resolve(targetPath);

  const agents = listAgents();
  const agent = agents.find((a: AgentInfo) => path.resolve(a.path) === absolutePath);

  if (!agent) {
    throw new Error(`No agent registered at ${absolutePath}`);
  }

  if (!agent.tmuxSession) {
    throw new Error(`Agent at ${absolutePath} has no tmux session`);
  }

  let command: string;
  let args: string[];

  if (agent.type === 'opencode') {
    command = 'opencode';
    args = ['acp'];
  } else if (agent.type === 'claude-code') {
    command = 'claude';
    args = ['code', '--agent'];
  } else {
    throw new Error(`Unknown agent type: ${agent.type}`);
  }

  const client = new ACPClient(command, args);
  const responseChunks: string[] = [];

  try {
    console.log('[Chat] Connecting to agent...');
    await client.initialize();

    client.onSessionUpdate((update) => {
      if (update.update.sessionUpdate === 'agent_message_chunk') {
        const content = update.update.content;
        if (content.type === 'text' && content.text) {
          responseChunks.push(content.text);
          process.stdout.write(content.text);
        }
      }
    });

    console.log('[Chat] Loading session:', agent.sessionId);
    await client.sessionLoad(agent.sessionId, absolutePath);

    const promptBlocks: ContentBlock[] = [
      { type: 'text', text: message },
    ];

    console.log('[Chat] Sending message...\n');
    const response = await client.sessionPrompt(agent.sessionId, promptBlocks);

    console.log('\n');
    console.log(`[Chat] Completed (stopReason: ${response.stopReason})`);

  } finally {
    client.close();
  }
}

export default chatCommand;
