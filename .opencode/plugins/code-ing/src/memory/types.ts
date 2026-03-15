/**
 * Memory System - Type Definitions
 *
 * Shared types for the memory system module
 */

/**
 * Memory system configuration
 */
export interface MemoryConfig {
  memory_dir: string;
  l0_max_messages: number;
  l1_summary_max_bytes: number;
  l2_summary_max_bytes: number;
}

/**
 * Single message record in L0
 */
export interface MessageRecord {
  timestamp: string;
  role: 'user' | 'assistant';
  content: string;
  source: 'feishu' | 'system';
}

/**
 * Daily summary in L1
 */
export interface DailySummary {
  date: string;
  topics: string[];
  summary: string;
  max_bytes: number;
}

/**
 * Weekly summary in L2
 */
export interface WeeklySummary {
  week_start: string;
  week_end: string;
  topics: string[];
  summary: string;
  max_bytes: number;
}

/**
 * Cron task definition
 */
export interface CronTask {
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
  author?: string;
  last_run?: string;
}

/**
 * Trigger type for context assembly
 */
export type TriggerType = 'feishu_message' | 'scheduled';

/**
 * Memory context assembled for injection
 */
export interface MemoryContext {
  directoryInfo: string;
  longTermMemory: {
    soul: string;
    people: string;
    tasks: string;
    cron?: string;
    cronSys?: string;
  };
  recentMessages: MessageRecord[];
  dailySummaries: DailySummary[];
  weeklySummaries: WeeklySummary[];
  triggerType: TriggerType;
}
