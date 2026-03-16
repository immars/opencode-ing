/**
 * Stuck Session Detector
 *
 * Periodically checks for stuck sessions and recovers them.
 * Also processes queued messages when session becomes idle.
 */

import type { OpencodeClient } from '@opencode-ai/sdk';
import {
  getQueueLength,
  removeFromQueue,
  getSessionTracking,
  clearSessionTracking,
  getSessionIdByChatId,
  setSessionTracking,
  updateLastUpdateTime,
  getAllKnownChats,
  STUCK_THRESHOLD_MS,
  STUCK_CHECK_INTERVAL_MS,
  type QueuedMessage,
} from '../state.js';
import { logger } from '../logger.js';

interface StuckDetectorDeps {
  client: OpencodeClient;
  directory: string;
}

const AGENT_NAME = 'assistant';

export async function checkAndProcessQueue(
  deps: StuckDetectorDeps,
  chatId: string
): Promise<void> {
  const { client, directory } = deps;
  const sessionId = getSessionIdByChatId(chatId);
  
  if (!sessionId) {
    return;
  }

  try {
    const statusResult = await client.session.status();
    const sessionStatus = statusResult.data?.[sessionId];
    const isBusy = sessionStatus?.type === 'busy';
    const tracking = getSessionTracking(chatId);
    const now = Date.now();

    if (isBusy) {
      if (tracking && (now - tracking.lastUpdateTime) > STUCK_THRESHOLD_MS) {
        logger.warn('StuckDetector', 'Session stuck detected, aborting:', sessionId);
        
        await client.session.abort({ path: { id: sessionId } });
        clearSessionTracking(chatId);
        
        const queueLength = getQueueLength(chatId);
        if (queueLength > 0) {
          await processNextQueuedMessage(deps, chatId, sessionId);
        }
      }
    } else {
      if (tracking) {
        logger.debug('StuckDetector', 'Clearing stale tracking for idle session:', chatId);
        clearSessionTracking(chatId);
      }
      
      const queueLength = getQueueLength(chatId);
      if (queueLength > 0) {
        logger.info('StuckDetector', 'Session idle with queue, processing:', chatId);
        await processNextQueuedMessage(deps, chatId, sessionId);
      }
    }
  } catch (err) {
    logger.error('StuckDetector', 'Error checking session:', err);
  }
}

async function processNextQueuedMessage(
  deps: StuckDetectorDeps,
  chatId: string,
  sessionId: string
): Promise<void> {
  const { client, directory } = deps;
  const msg = removeFromQueue(chatId);
  
  if (!msg) return;

  try {
    setSessionTracking(chatId, {
      lastUpdateTime: Date.now(),
      sessionId,
    });

    await client.session.promptAsync({
      path: { id: sessionId },
      body: {
        agent: AGENT_NAME,
        parts: [{ type: 'text', text: msg.textContent }],
      },
    });

    logger.info('StuckDetector', 'Sent queued message to session:', chatId);
  } catch (err) {
    logger.error('StuckDetector', 'Failed to send queued message:', err);
    clearSessionTracking(chatId);
  }
}

export async function runStuckDetection(deps: StuckDetectorDeps): Promise<void> {
  const allChats = getAllKnownChats();
  
  for (const chatId of allChats) {
    await checkAndProcessQueue(deps, chatId);
  }
}

export function startStuckDetector(deps: StuckDetectorDeps): NodeJS.Timeout {
  const timer = setInterval(() => {
    runStuckDetection(deps).catch((err) => {
      logger.error('StuckDetector', 'Stuck detection cycle failed:', err);
    });
  }, STUCK_CHECK_INTERVAL_MS);

  return timer;
}
