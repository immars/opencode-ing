/**
 * L9 - Long-term Memory Module
 *
 * Handles SOUL.md, PEOPLE.md, TASK.md, CRON.md, CRON_SYS.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { MEMORY_DIR, WORKSPACE_DIR, L9_FILES } from './constants.js';

/**
 * Get the workspace directory for L9 files
 */
function getRootDir(projectDir: string): string {
  return join(projectDir, WORKSPACE_DIR);
}

/**
 * Ensure root memory directory exists
 */
function ensureRootDir(projectDir: string): void {
  const dir = getRootDir(projectDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get file path for L9 file
 */
function getL9FilePath(projectDir: string, filename: string): string {
  return join(getRootDir(projectDir), filename);
}

/**
 * Read SOUL.md - Agent personality
 */
export function readSoul(projectDir: string): string {
  const filePath = getL9FilePath(projectDir, L9_FILES.SOUL);
  if (!existsSync(filePath)) {
    return '';
  }
  return readFileSync(filePath, 'utf-8');
}

/**
 * Write SOUL.md - Agent personality
 */
export function writeSoul(projectDir: string, content: string): void {
  ensureRootDir(projectDir);
  const filePath = getL9FilePath(projectDir, L9_FILES.SOUL);
  writeFileSync(filePath, content);
}

/**
 * Read PEOPLE.md - User profiles
 */
export function readPeople(projectDir: string): string {
  const filePath = getL9FilePath(projectDir, L9_FILES.PEOPLE);
  if (!existsSync(filePath)) {
    return '';
  }
  return readFileSync(filePath, 'utf-8');
}

/**
 * Write PEOPLE.md - User profiles
 */
export function writePeople(projectDir: string, content: string): void {
  ensureRootDir(projectDir);
  const filePath = getL9FilePath(projectDir, L9_FILES.PEOPLE);
  writeFileSync(filePath, content);
}

/**
 * Read TASK.md - Current tasks
 */
export function readTasks(projectDir: string): string {
  const filePath = getL9FilePath(projectDir, L9_FILES.TASK);
  if (!existsSync(filePath)) {
    return '';
  }
  return readFileSync(filePath, 'utf-8');
}

/**
 * Write TASK.md - Current tasks
 */
export function writeTasks(projectDir: string, content: string): void {
  ensureRootDir(projectDir);
  const filePath = getL9FilePath(projectDir, L9_FILES.TASK);
  writeFileSync(filePath, content);
}

/**
 * Read CRON.md - User-defined cron tasks
 */
export function readCron(projectDir: string): string {
  const filePath = getL9FilePath(projectDir, L9_FILES.CRON);
  if (!existsSync(filePath)) {
    return '';
  }
  return readFileSync(filePath, 'utf-8');
}

/**
 * Write CRON.md - User-defined cron tasks
 */
export function writeCron(projectDir: string, content: string): void {
  ensureRootDir(projectDir);
  const filePath = getL9FilePath(projectDir, L9_FILES.CRON);
  writeFileSync(filePath, content);
}

/**
 * Read CRON_SYS.md - System cron tasks
 */
export function readCronSys(projectDir: string): string {
  const filePath = getL9FilePath(projectDir, L9_FILES.CRON_SYS);
  if (!existsSync(filePath)) {
    return '';
  }
  return readFileSync(filePath, 'utf-8');
}

/**
 * Write CRON_SYS.md - System cron tasks
 */
export function writeCronSys(projectDir: string, content: string): void {
  ensureRootDir(projectDir);
  const filePath = getL9FilePath(projectDir, L9_FILES.CRON_SYS);
  writeFileSync(filePath, content);
}

/**
 * Read all L9 files at once
 */
export function readAllL9(projectDir: string): {
  soul: string;
  people: string;
  tasks: string;
  cron: string;
  cronSys: string;
} {
  return {
    soul: readSoul(projectDir),
    people: readPeople(projectDir),
    tasks: readTasks(projectDir),
    cron: readCron(projectDir),
    cronSys: readCronSys(projectDir),
  };
}

interface FeishuConfig {
  app_id: string;
  app_secret: string;
  message?: {
    poll_interval?: number;
    group_ids?: string[];
  };
  connection?: {
    enabled?: boolean;
    reconnect_interval?: number;
  };
}

/**
 * Simple YAML parser for basic key-value pairs
 */
function parseYaml(content: string): any {
  const result: any = {};
  let currentObj: any = result;
  let currentKey = '';
  
  content.split('\n').forEach(line => {
    const indent = line.search(/\S/);
    const match = line.match(/^(\s*)(\w+):\s*(.*)$/);
    
    if (match && indent >= 0) {
      const [, , key, value] = match;
      
      if (indent === 0) {
        if (value.trim()) {
          result[key] = value.trim().replace(/['"]/g, '');
        } else {
          result[key] = {};
          currentObj = result[key];
        }
        currentKey = key;
      } else if (indent === 2) {
        if (value.trim()) {
          currentObj[key] = value.trim().replace(/['"]/g, '');
        } else {
          currentObj[key] = {};
        }
      }
    }
  });
  
  return result;
}

/**
 * Load Feishu configuration from .code-ing/config/feishu.yaml
 */
export function loadFeishuConfig(projectDir: string): FeishuConfig | null {
  const configPath = join(projectDir, '.code-ing', 'config', 'feishu.yaml');
  console.error('[code-ing] loadFeishuConfig:', { projectDir, configPath });
  
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(configPath, 'utf-8');
    return parseYaml(content) as FeishuConfig;
  } catch (e) {
    return null;
  }
}
