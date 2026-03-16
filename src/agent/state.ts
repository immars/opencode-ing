/**
 * Agent State Module
 *
 * Centralizes state management for the agent domain.
 */

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
