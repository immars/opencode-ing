/**
 * Memory System - Constants
 *
 * Directory and file path constants
 */

/** Memory root directory (where L0/L1/L2 live) */
export const MEMORY_ROOT_DIR = '.code-ing/memory';

/** Workspace directory (alias for .code-ing) */
export const WORKSPACE_DIR = '.code-ing';

/** L0: Raw message records */
export const L0_DIR = 'L0';

/** L1: Daily summaries */
export const L1_DIR = 'L1';

/** L2: Weekly summaries */
export const L2_DIR = 'L2';

/** L9: Long-term memory files (in root) */
export const L9_FILES = {
  SOUL: 'SOUL.md',
  PEOPLE: 'PEOPLE.md',
  TASK: 'TASK.md',
  CRON: 'CRON.md',
  CRON_SYS: 'CRON_SYS.md',
} as const;

/** Directory paths relative to MEMORY_ROOT_DIR */
export const PATHS = {
  L0: `${MEMORY_ROOT_DIR}/${L0_DIR}`,
  L1: `${MEMORY_ROOT_DIR}/${L1_DIR}`,
  L2: `${MEMORY_ROOT_DIR}/${L2_DIR}`,
} as const;

/** Default configuration values */
/**
 * L1 and L2 lookback increased from 3 to 5 to help agent remember
 * more context from the past (issue #1)
 */
export const DEFAULTS = {
  L0_MAX_MESSAGES: 60,
  L1_SUMMARY_MAX_BYTES: 500,
  L2_SUMMARY_MAX_BYTES: 500,
  L1_LOOKBACK_DAYS: 5,
  L2_LOOKBACK_WEEKS: 5,
  SESSION_MAX_AGE_DAYS: 1,
  SESSION_MAX_ROLLING: 3,
  SESSION_MAX_AGE_HOURS: 6,
  SESSION_MAX_KEEP: 5,
} as const;
