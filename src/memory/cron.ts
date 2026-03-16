/**
 * Cron - Cron Parser Module
 *
 * Parses CRON.md and CRON_SYS.md files
 */

import type { CronTask } from './types.js';

/**
 * Parse CRON file content into CronTask array
 */
export function parseCronFile(content: string): CronTask[] {
  if (!content.trim()) {
    return [];
  }

  const tasks: CronTask[] = [];
  const sections = content.split(/^# /m);

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split('\n');
    const title = lines[0].trim();

    let name = '';
    let schedule = '';
    let description = '';
    let enabled = true;
    let author = '';

    for (const line of lines.slice(1)) {
      let trimmed = line.trim();
      if (trimmed.startsWith('* ')) {
        trimmed = trimmed.substring(2);
      }
      
      if (trimmed.startsWith('name:')) {
        name = trimmed.substring(5).trim();
      } else if (trimmed.startsWith('schedule:')) {
        schedule = trimmed.substring(9).trim().replace(/`/g, '');
      } else if (trimmed.startsWith('description:') || trimmed.startsWith('descrption:')) {
        description = trimmed.substring(12).trim();
      } else if (trimmed.startsWith('enabled:')) {
        enabled = trimmed.substring(8).trim().toLowerCase() === 'true';
      } else if (trimmed.startsWith('author:')) {
        author = trimmed.substring(7).trim();
      }
    }

    if (name && schedule) {
      tasks.push({
        name: name || title,
        schedule,
        description,
        enabled,
        author: author || undefined,
      });
    }
  }

  return tasks;
}

/**
 * Parse a single cron expression
 * Format: minute hour day-of-month month day-of-week
 */
export function parseCronExpression(
  expression: string
): {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
} | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }

  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dayOfMonth: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    dayOfWeek: parseField(parts[4], 0, 6),
  };
}

/**
 * Parse a single cron field (handles *, ranges, lists, steps)
 */
function parseField(field: string, min: number, max: number): number[] {
  const result: number[] = [];

  if (field === '*') {
    for (let i = min; i <= max; i++) {
      result.push(i);
    }
    return result;
  }

  // Handle step values (e.g., */30)
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    const stepNum = parseInt(step, 10);
    const start = range === '*' ? min : parseInt(range, 10);
    for (let i = start; i <= max; i += stepNum) {
      result.push(i);
    }
    return result;
  }

  // Handle lists (e.g., 0,30)
  if (field.includes(',')) {
    const values = field.split(',');
    for (const v of values) {
      if (v.includes('-')) {
        const [start, end] = v.split('-').map((n) => parseInt(n, 10));
        for (let i = start; i <= end; i++) {
          result.push(i);
        }
      } else {
        result.push(parseInt(v, 10));
      }
    }
    return result;
  }

  // Handle ranges (e.g., 1-5)
  if (field.includes('-')) {
    const [start, end] = field.split('-').map((n) => parseInt(n, 10));
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  }

  // Single value
  result.push(parseInt(field, 10));
  return result;
}

/**
 * Check if a cron task should run at the given time
 */
export function shouldRunNow(task: CronTask, currentTime: Date): boolean {
  if (!task.enabled) {
    return false;
  }

  const parsed = parseCronExpression(task.schedule);
  if (!parsed) {
    return false;
  }

  const minute = currentTime.getMinutes();
  const hour = currentTime.getHours();
  const dayOfMonth = currentTime.getDate();
  const month = currentTime.getMonth() + 1; // 1-12
  const dayOfWeek = currentTime.getDay(); // 0-6

  return (
    parsed.minute.includes(minute) &&
    parsed.hour.includes(hour) &&
    parsed.dayOfMonth.includes(dayOfMonth) &&
    parsed.month.includes(month) &&
    parsed.dayOfWeek.includes(dayOfWeek)
  );
}

/**
 * Get tasks that should run now from a list
 */
export function getActiveTasks(tasks: CronTask[], currentTime: Date = new Date()): CronTask[] {
  return tasks.filter((task) => shouldRunNow(task, currentTime));
}

/**
 * Extract single task content from full cron file content
 */
export function extractTaskContent(fullContent: string, taskName: string): string {
  const sections = fullContent.split(/^# /m);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    const lines = section.split('\n');
    const title = lines[0].trim();
    
    if (title === taskName) {
      return section;
    }
    
    for (let line of lines.slice(1)) {
      let trimmed = line.trim();
      if (trimmed.startsWith('* ')) {
        trimmed = trimmed.substring(2);
      }
      if (trimmed.startsWith('name:') && trimmed.substring(5).trim() === taskName) {
        return section;
      }
    }
  }
  
  return '';
}
