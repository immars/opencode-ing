/**
 * CLI Entry Point
 *
 * Handles argument parsing for coding-agent-cli commands.
 */

import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { listCommand } from './commands/list.js';
import { taskCommand } from './commands/task.js';

const VERSION = '1.0.0';

function printHelp(): void {
  console.log(`coding-agent-cli v${VERSION}`);
  console.log('');
  console.log('Usage:');
  console.log(`  coding-agent-cli --help                     Show this help message`);
  console.log(`  coding-agent-cli --version                  Show version`);
  console.log(`  coding-agent-cli start <path> --type <opencode|claude-code>  Start agent`);
  console.log(`  coding-agent-cli stop <path>               Stop agent`);
  console.log(`  coding-agent-cli status [path]              Check status`);
  console.log(`  coding-agent-cli list                      List all agents`);
  console.log(`  coding-agent-cli task <path> <task-file>    Run task`);
}

function printVersion(): void {
  console.log(`coding-agent-cli v${VERSION}`);
}

interface ParseArgs {
  _: string[];
  [key: string]: unknown;
}

function parseArgs(argv: string[]): { command: string; args: ParseArgs } {
  const command = argv[2] || '';
  const args: ParseArgs = { _: [] };

  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const flag = arg.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[flag] = argv[++i];
      } else {
        args[flag] = true;
      }
    } else if (arg.startsWith('-')) {
      const flag = arg.slice(1);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--') && !argv[i + 1].startsWith('-')) {
        args[flag] = argv[++i];
      } else {
        args[flag] = true;
      }
    } else {
      args._.push(arg);
    }
  }

  return { command, args };
}

export async function main(argv: string[] = process.argv): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return 0;
  }

  if (argv.includes('--version') || argv.includes('-v')) {
    printVersion();
    return 0;
  }

  const { command, args } = parseArgs(argv);

  switch (command) {
    case 'start': {
      const targetPath = args._[0];
      const agentType = args.type as 'opencode' | 'claude-code' | undefined;

      if (!targetPath) {
        console.error('[CLI] Error: <path> is required');
        console.error('Usage: coding-agent-cli start <path> --type <opencode|claude-code>');
        return 1;
      }

      if (!agentType) {
        console.error('[CLI] Error: --type <opencode|claude-code> is required');
        console.error('Usage: coding-agent-cli start <path> --type <opencode|claude-code>');
        return 1;
      }

      if (agentType !== 'opencode' && agentType !== 'claude-code') {
        console.error(`[CLI] Error: Invalid type '${agentType}'. Must be 'opencode' or 'claude-code'`);
        return 1;
      }

      try {
        await startCommand(targetPath, agentType);
        return 0;
      } catch (error) {
        console.error('[CLI] Failed to start agent:', error);
        return 1;
      }
    }

    case 'stop': {
      const targetPath = args._[0];

      if (!targetPath) {
        console.error('[CLI] Error: <path> is required');
        console.error('Usage: coding-agent-cli stop <path>');
        return 1;
      }

      try {
        await stopCommand(targetPath);
        return 0;
      } catch (error) {
        console.error('[CLI] Failed to stop agent:', error);
        return 1;
      }
    }

    case 'status': {
      const targetPath = args._[0] as string | undefined;
      await statusCommand(targetPath);
      return 0;
    }

    case 'list':
      await listCommand();
      return 0;

    case 'task': {
      const targetPath = args._[0];
      const taskFilePath = args._[1];

      if (!targetPath) {
        console.error('[CLI] Error: <path> is required');
        console.error('Usage: coding-agent-cli task <path> <task-file>');
        return 1;
      }

      if (!taskFilePath) {
        console.error('[CLI] Error: <task-file> is required');
        console.error('Usage: coding-agent-cli task <path> <task-file>');
        return 1;
      }

      try {
        await taskCommand(targetPath, taskFilePath);
        return 0;
      } catch (error) {
        console.error('[CLI] Failed to run task:', error);
        return 1;
      }
    }

    case '':
      printHelp();
      return 0;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('');
      printHelp();
      return 1;
  }
}

main(process.argv);
