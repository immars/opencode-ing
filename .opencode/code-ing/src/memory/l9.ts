/**
 * L9 - Long-term Memory Module
 *
 * Handles SOUL.md, PEOPLE.md, TASK.md, CRON.md, CRON_SYS.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { MEMORY_DIR, L9_FILES } from './constants.js';

/**
 * Get the root memory directory path
 */
function getRootDir(projectDir: string): string {
  return join(projectDir, MEMORY_DIR);
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
