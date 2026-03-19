/**
 * CLI Entry Point
 *
 * Handles argument parsing for coding-agent-cli commands.
 */

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

export function main(argv: string[] = process.argv): number {
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
    case 'start':
      console.log('[CLI] start command detected');
      console.log('[CLI] path:', args._[0] || '(missing)');
      console.log('[CLI] type:', args.type || '(missing)');
      return 0;

    case 'stop':
      console.log('[CLI] stop command detected');
      console.log('[CLI] path:', args._[0] || '(missing)');
      return 0;

    case 'status':
      console.log('[CLI] status command detected');
      console.log('[CLI] path:', args._[0] || '(current directory)');
      return 0;

    case 'list':
      console.log('[CLI] list command detected');
      return 0;

    case 'task':
      console.log('[CLI] task command detected');
      console.log('[CLI] path:', args._[0] || '(missing)');
      console.log('[CLI] task-file:', args._[1] || '(missing)');
      return 0;

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
