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
// Message Queue & Stuck Detection State
// ============================================================================

/** Message in the pending queue */
export interface QueuedMessage {
  textContent: string;
  messageId: string;
  timestamp: number;
  senderId?: string;
  senderName?: string;
}

/** Session tracking info for stuck detection */
export interface SessionTracking {
  lastUpdateTime: number;
  sessionId: string;
}

/** Pending message queues per chat */
const pendingQueues = new Map<string, QueuedMessage[]>();

/** Session tracking per chat (for stuck detection) */
const sessionTracking = new Map<string, SessionTracking>();

/** chatId → sessionId mapping */
const chatToSession = new Map<string, string>();

/** Stuck detector timer */
let stuckDetectorTimer: NodeJS.Timeout | null = null;

/** Stuck detection threshold in ms (5 minutes) */
export const STUCK_THRESHOLD_MS = 5 * 60 * 1000;

/** Stuck detection check interval in ms (30 seconds) */
export const STUCK_CHECK_INTERVAL_MS = 30 * 1000;

// Queue operations
export function getQueue(chatId: string): QueuedMessage[] {
  return pendingQueues.get(chatId) || [];
}

export function addToQueue(chatId: string, msg: QueuedMessage): number {
  let queue = pendingQueues.get(chatId);
  if (!queue) {
    queue = [];
    pendingQueues.set(chatId, queue);
  }
  queue.push(msg);
  return queue.length;
}

export function removeFromQueue(chatId: string): QueuedMessage | undefined {
  const queue = pendingQueues.get(chatId);
  if (!queue || queue.length === 0) return undefined;
  return queue.shift();
}

export function getQueueLength(chatId: string): number {
  return pendingQueues.get(chatId)?.length || 0;
}

export function clearQueue(chatId: string): void {
  pendingQueues.delete(chatId);
}

// Session tracking operations
export function getSessionTracking(chatId: string): SessionTracking | undefined {
  return sessionTracking.get(chatId);
}

export function setSessionTracking(chatId: string, tracking: SessionTracking): void {
  sessionTracking.set(chatId, tracking);
}

export function updateLastUpdateTime(chatId: string): void {
  const tracking = sessionTracking.get(chatId);
  if (tracking) {
    tracking.lastUpdateTime = Date.now();
  }
}

export function clearSessionTracking(chatId: string): void {
  sessionTracking.delete(chatId);
}

// chatId ↔ sessionId mapping
export function getSessionIdByChatId(chatId: string): string | undefined {
  return chatToSession.get(chatId);
}

export function setChatSessionMapping(chatId: string, sessionId: string): void {
  chatToSession.set(chatId, sessionId);
}

export function getChatIdBySessionId(sessionId: string): string | undefined {
  for (const [chatId, sid] of chatToSession.entries()) {
    if (sid === sessionId) return chatId;
  }
  return undefined;
}

export function clearChatSessionMapping(chatId: string): void {
  chatToSession.delete(chatId);
}

// Stuck detector timer
export function getStuckDetectorTimer(): NodeJS.Timeout | null {
  return stuckDetectorTimer;
}

export function setStuckDetectorTimer(timer: NodeJS.Timeout | null): void {
  stuckDetectorTimer = timer;
}

// Get all tracked chats for iteration
export function getAllTrackedChats(): string[] {
  return Array.from(sessionTracking.keys());
}

export function getAllKnownChats(): string[] {
  return Array.from(chatToSession.keys());
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
  pendingQueues.clear();
  sessionTracking.clear();
  chatToSession.clear();
  stuckDetectorTimer = null;
}
