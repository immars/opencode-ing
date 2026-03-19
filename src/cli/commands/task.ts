/**
 * Task Command
 *
 * Sends a task to a running agent via ACP protocol.
 */

import path from 'node:path';
import { parseTaskFile, writeTaskResult, type TaskFile, type TaskResult } from '../task-file.js';
import { listAgents, type AgentInfo } from '../registry.js';
import { ACPClient } from '../acp/client.js';
import type { ContentBlock } from '../acp/types.js';

export interface TaskCommandOptions {
  targetPath: string;
  taskFilePath: string;
}

/**
 * Build prompt ContentBlock[] from task file
 */
function buildPrompt(task: TaskFile): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  // Add description as text block
  blocks.push({
    type: 'text',
    text: `Task: ${task.description}`,
  });

  // Add requirements as numbered list
  if (task.requirements.length > 0) {
    const requirementsText = task.requirements
      .map((req, i) => `${i + 1}. ${req}`)
      .join('\n');
    blocks.push({
      type: 'text',
      text: `Requirements:\n${requirementsText}`,
    });
  }

  // Add context instructions if present
  if (task.context.instructions) {
    blocks.push({
      type: 'text',
      text: `Context:\n${task.context.instructions}`,
    });
  }

  // Add file references if present
  if (task.context.files && task.context.files.length > 0) {
    blocks.push({
      type: 'text',
      text: `Files to reference:\n${task.context.files.join('\n')}`,
    });
  }

  return blocks;
}

/**
 * Task command - sends a task to a running agent
 */
export async function taskCommand(targetPath: string, taskFilePath: string): Promise<void> {
  const absolutePath = path.resolve(targetPath);
  const absoluteTaskFilePath = path.resolve(taskFilePath);

  console.log(`[Task] Sending task from: ${absoluteTaskFilePath}`);
  console.log(`[Task] Target agent path: ${absolutePath}`);

  // 1. Parse the task file
  const task = parseTaskFile(absoluteTaskFilePath);
  if (!task) {
    throw new Error(`Failed to parse task file: ${absoluteTaskFilePath}`);
  }

  console.log(`[Task] Loaded task: ${task.taskId}`);
  console.log(`[Task] Description: ${task.description}`);

  // 2. Find agent running at targetPath
  const agents = listAgents({ status: 'running' });
  const agent = agents.find((a: AgentInfo) => a.path === absolutePath);

  if (!agent) {
    throw new Error(`No agent running at ${absolutePath}`);
  }

  console.log(`[Task] Found agent: ${agent.type} (session: ${agent.sessionId}, pid: ${agent.pid})`);

  // 3. Create ACP client to communicate with agent
  // Note: We need to create a new client that connects to the same agent
  // The agent type determines how we connect
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

  try {
    // Initialize connection
    console.log('[Task] Initializing ACP connection...');
    await client.initialize();
    console.log('[Task] ACP connection initialized');

    // 4. Build prompt from task content
    const promptBlocks = buildPrompt(task);
    console.log(`[Task] Built prompt with ${promptBlocks.length} content blocks`);

    // 5. Set up session update handler to collect response chunks
    const responseChunks: string[] = [];
    client.onSessionUpdate((update) => {
      // Handle agent message chunks
      if ('sessionUpdate' in update.update) {
        const sessionUpdate = update.update.sessionUpdate;
        if (sessionUpdate === 'agent_message_chunk') {
          // This is where agent response chunks would come
          // The actual content block would be in update.update
        }
      }
    });

    // 6. Send prompt and wait for response
    console.log('[Task] Sending prompt to agent...');
    const response = await client.sessionPrompt(agent.sessionId, promptBlocks);

    console.log(`[Task] Received response, stopReason: ${response.stopReason}`);

    // 7. Build output file path (result.json alongside task file)
    const outputPath = absoluteTaskFilePath.replace(/\.json$/, '') + '.result.json';

    // 8. Write task result
    const taskResult: TaskResult = {
      taskId: task.taskId,
      status: response.stopReason === 'end_turn' ? 'success' : 'failure',
      output: responseChunks.join(''),
      completedAt: new Date().toISOString(),
    };

    const written = writeTaskResult(outputPath, taskResult);
    if (!written) {
      throw new Error(`Failed to write task result to: ${outputPath}`);
    }

    // 9. Output success message
    console.log('');
    console.log('========================================');
    console.log('Task completed successfully!');
    console.log('========================================');
    console.log(`Task ID: ${task.taskId}`);
    console.log(`Status: ${taskResult.status}`);
    console.log(`Result file: ${outputPath}`);
    console.log('========================================');
    console.log('');

  } finally {
    client.close();
  }
}

export default taskCommand;
