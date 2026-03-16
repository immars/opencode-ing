/**
 * Application State Module
 *
 * Centralized state management for the application.
 * All module-level mutable state is consolidated here for:
 * - Clear dependency tracking
 * - Easier testing (state can be reset)
 * - Single source of truth for shared state
 */

// ============================================================================
// Feishu Client State
// ============================================================================

/** Cached Feishu client credentials */
let cachedClient: { appId: string; appSecret: string } | null = null;

/** Project directory for cached client */
let cachedProjectDir: string | null = null;

/** Lark API client cache by app ID */
const larkClientCache = new Map<string, any>();

/** WebSocket client instance */
let feishuWSClient: any = null;

export function getCachedClient(): { appId: string; appSecret: string } | null {
  return cachedClient;
}

export function setCachedClient(client: { appId: string; appSecret: string } | null): void {
  cachedClient = client;
}

export function getCachedProjectDir(): string | null {
  return cachedProjectDir;
}

export function setCachedProjectDir(dir: string | null): void {
  cachedProjectDir = dir;
}

export function getLarkClientCache(): Map<string, any> {
  return larkClientCache;
}

export function clearLarkClientCache(): void {
  larkClientCache.clear();
}

export function getLarkClientFromCache(appId: string): any | undefined {
  return larkClientCache.get(appId);
}

export function setLarkClientToCache(appId: string, client: any): void {
  larkClientCache.set(appId, client);
}

export function getFeishuWSClient(): any {
  return feishuWSClient;
}

export function setFeishuWSClient(client: any): void {
  feishuWSClient = client;
}

// ============================================================================
// Scheduler State
// ============================================================================

/** Scheduler interval timer */
let schedulerInterval: NodeJS.Timeout | null = null;

/** Scheduler running flag */
let schedulerRunning = false;

/** Scheduler client reference */
let schedulerClient: any = null;

/** Scheduler project directory */
let schedulerProjectDir: string = '';

export function getSchedulerInterval(): NodeJS.Timeout | null {
  return schedulerInterval;
}

export function setSchedulerInterval(interval: NodeJS.Timeout | null): void {
  schedulerInterval = interval;
}

export function getSchedulerRunningState(): boolean {
  return schedulerRunning;
}

export function setSchedulerRunning(running: boolean): void {
  schedulerRunning = running;
}

export function getSchedulerClient(): any {
  return schedulerClient;
}

export function setSchedulerClient(client: any): void {
  schedulerClient = client;
}

export function getSchedulerProjectDir(): string {
  return schedulerProjectDir;
}

export function setSchedulerProjectDir(dir: string): void {
  schedulerProjectDir = dir;
}

// ============================================================================
// Heartbeat State
// ============================================================================

/** Heartbeat timer for connection checks */
let heartbeatTimer: NodeJS.Timeout | null = null;

export function getHeartbeatTimer(): NodeJS.Timeout | null {
  return heartbeatTimer;
}

export function setHeartbeatTimer(timer: NodeJS.Timeout | null): void {
  heartbeatTimer = timer;
}

// ============================================================================
// Logger State
// ============================================================================

interface LogClient {
  app: {
    log: (options: {
      body: {
        service: string;
        level: string;
        message: string;
        extra?: Record<string, unknown>;
      };
    }) => Promise<unknown>;
  };
}

let logClient: LogClient | null = null;

export function getLogClient(): LogClient | null {
  return logClient;
}

export function setLogClient(client: LogClient | null): void {
  logClient = client;
}

// ============================================================================
// Session Event State
// ============================================================================

/** Processed message IDs cache to avoid duplicate processing */
const processedMessages = new Set<string>();
const MAX_PROCESSED_CACHE = 100;

export function hasProcessedMessage(messageId: string): boolean {
  return processedMessages.has(messageId);
}

export function markMessageProcessed(messageId: string): boolean {
  if (processedMessages.has(messageId)) {
    return false;
  }
  processedMessages.add(messageId);
  if (processedMessages.size > MAX_PROCESSED_CACHE) {
    const first = processedMessages.values().next().value;
    if (first) processedMessages.delete(first);
  }
  return true;
}

export function clearProcessedMessages(): void {
  processedMessages.clear();
}

// ============================================================================
// Reset All State (for testing)
// ============================================================================

export function resetAllState(): void {
  cachedClient = null;
  cachedProjectDir = null;
  larkClientCache.clear();
  feishuWSClient = null;
  schedulerInterval = null;
  schedulerRunning = false;
  schedulerClient = null;
  schedulerProjectDir = '';
  heartbeatTimer = null;
  logClient = null;
  processedMessages.clear();
}
