/**
 * Logger Module
 *
 * Provides unified logging via OpenCode plugin's client.app.log API
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogClient {
  app: {
    log: (options: {
      body: {
        service: string;
        level: LogLevel;
        message: string;
        extra?: Record<string, unknown>;
      };
    }) => Promise<unknown>;
  };
}

let _client: LogClient | null = null;

export function setLoggerClient(client: LogClient): void {
  _client = client;
}

function formatArgs(args: unknown[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return `${arg.message}\n${arg.stack || ''}`;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }).join(' ');
}

async function writeLog(level: LogLevel, service: string, ...args: unknown[]): Promise<void> {
  const message = formatArgs(args);
  
  // Fallback to console if client not set
  if (!_client) {
    const prefix = `[${service}]`;
    switch (level) {
      case 'error':
        console.error(prefix, ...args);
        break;
      case 'warn':
        console.warn(prefix, ...args);
        break;
      default:
        console.log(prefix, ...args);
    }
    return;
  }

  try {
    await _client.app.log({
      body: { service, level, message }
    });
  } catch {
    // Fallback to console if log API fails
    console.error(`[${service}]`, ...args);
  }
}

export const logger = {
  debug: (service: string, ...args: unknown[]) => writeLog('debug', service, ...args),
  info: (service: string, ...args: unknown[]) => writeLog('info', service, ...args),
  warn: (service: string, ...args: unknown[]) => writeLog('warn', service, ...args),
  error: (service: string, ...args: unknown[]) => writeLog('error', service, ...args),
};

export default logger;
