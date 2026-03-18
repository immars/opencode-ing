/**
 * Memory System - Utilities
 *
 * Common file operations for memory modules.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { MEMORY_ROOT_DIR, WORKSPACE_DIR, L0_DIR, L1_DIR, L2_DIR } from './constants.js';

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayString(): string {
  return formatLocalDate(new Date());
}

export function getNowString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${getTodayString()} ${hours}:${minutes}:${seconds}`;
}

export function getMemoryDir(projectDir: string, subDir: string): string {
  return join(projectDir, MEMORY_ROOT_DIR, subDir);
}

export function getMemoryRootDir(projectDir: string): string {
  return join(projectDir, MEMORY_ROOT_DIR);
}

export function ensureMemoryDir(projectDir: string, subDir: string): void {
  const dir = getMemoryDir(projectDir, subDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function ensureMemoryRootDir(projectDir: string): void {
  const dir = getMemoryRootDir(projectDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function getMemoryFilePath(projectDir: string, subDir: string, filename: string): string {
  return join(getMemoryDir(projectDir, subDir), filename);
}

export function getMemoryRootFilePath(projectDir: string, filename: string): string {
  return join(getMemoryRootDir(projectDir), filename);
}

export function readMemoryFile(projectDir: string, subDir: string, filename: string): string {
  const filePath = getMemoryFilePath(projectDir, subDir, filename);
  if (!existsSync(filePath)) {
    return '';
  }
  return readFileSync(filePath, 'utf-8');
}

export function readMemoryRootFile(projectDir: string, filename: string): string {
  const filePath = getMemoryRootFilePath(projectDir, filename);
  if (!existsSync(filePath)) {
    return '';
  }
  return readFileSync(filePath, 'utf-8');
}

export function writeMemoryFile(
  projectDir: string,
  subDir: string,
  filename: string,
  content: string
): void {
  ensureMemoryDir(projectDir, subDir);
  const filePath = getMemoryFilePath(projectDir, subDir, filename);
  writeFileSync(filePath, content);
}

export function writeMemoryRootFile(
  projectDir: string,
  filename: string,
  content: string
): void {
  ensureMemoryRootDir(projectDir);
  const filePath = getMemoryRootFilePath(projectDir, filename);
  writeFileSync(filePath, content);
}

export function fileExists(projectDir: string, subDir: string, filename: string): boolean {
  return existsSync(getMemoryFilePath(projectDir, subDir, filename));
}

export function memoryRootFileExists(projectDir: string, filename: string): boolean {
  return existsSync(getMemoryRootFilePath(projectDir, filename));
}

export function listMemoryFiles(projectDir: string, subDir: string, extension?: string): string[] {
  const dir = getMemoryDir(projectDir, subDir);
  if (!existsSync(dir)) {
    return [];
  }
  
  let files = readdirSync(dir);
  if (extension) {
    files = files.filter(f => f.endsWith(extension));
  }
  return files;
}

export function getWorkspaceDir(projectDir: string): string {
  return join(projectDir, WORKSPACE_DIR);
}

export function ensureWorkspaceDir(projectDir: string): void {
  const dir = getWorkspaceDir(projectDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export const ensureRootDir = ensureWorkspaceDir;

export function getWorkspaceFilePath(projectDir: string, filename: string): string {
  return join(getWorkspaceDir(projectDir), filename);
}

export { L0_DIR, L1_DIR, L2_DIR };

// ============================================================================
// Session-specific paths (for per-chat L0 storage)
// ============================================================================

/** Session directory root: memory/sessions/ */
export const SESSIONS_DIR = 'sessions';

/**
 * Get the session root directory: memory/sessions/{chatId}/
 */
export function getSessionDir(projectDir: string, chatId: string): string {
  return join(projectDir, MEMORY_ROOT_DIR, SESSIONS_DIR, chatId);
}

/**
 * Get session L0 directory: memory/sessions/{chatId}/L0/
 */
export function getSessionL0Dir(projectDir: string, chatId: string): string {
  return join(getSessionDir(projectDir, chatId), L0_DIR);
}

/**
 * Ensure session L0 directory exists
 */
export function ensureSessionL0Dir(projectDir: string, chatId: string): void {
  const dir = getSessionL0Dir(projectDir, chatId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get session L0 file path: memory/sessions/{chatId}/L0/{date}.md
 */
export function getSessionL0FilePath(projectDir: string, chatId: string, date: string): string {
  return join(getSessionL0Dir(projectDir, chatId), `${date}.md`);
}

/**
 * Get session L1 directory: memory/sessions/{chatId}/L1/
 */
export function getSessionL1Dir(projectDir: string, chatId: string): string {
  return join(getSessionDir(projectDir, chatId), L1_DIR);
}

/**
 * Ensure session L1 directory exists
 */
export function ensureSessionL1Dir(projectDir: string, chatId: string): void {
  const dir = getSessionL1Dir(projectDir, chatId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get session L1 file path: memory/sessions/{chatId}/L1/{date}.md
 */
export function getSessionL1FilePath(projectDir: string, chatId: string, date: string): string {
  return join(getSessionL1Dir(projectDir, chatId), `${date}.md`);
}

/**
 * List session L1 files
 */
export function listSessionL1Files(projectDir: string, chatId: string, extension?: string): string[] {
  const dir = getSessionL1Dir(projectDir, chatId);
  if (!existsSync(dir)) {
    return [];
  }
  
  let files = readdirSync(dir);
  if (extension) {
    files = files.filter(f => f.endsWith(extension));
  }
  return files;
}

/**
 * Get session L2 directory: memory/sessions/{chatId}/L2/
 */
export function getSessionL2Dir(projectDir: string, chatId: string): string {
  return join(getSessionDir(projectDir, chatId), L2_DIR);
}

/**
 * Ensure session L2 directory exists
 */
export function ensureSessionL2Dir(projectDir: string, chatId: string): void {
  const dir = getSessionL2Dir(projectDir, chatId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get session L2 file path: memory/sessions/{chatId}/L2/{weekStart}.md
 */
export function getSessionL2FilePath(projectDir: string, chatId: string, weekStart: string): string {
  return join(getSessionL2Dir(projectDir, chatId), `${weekStart}.md`);
}

/**
 * List session L2 files
 */
export function listSessionL2Files(projectDir: string, chatId: string, extension?: string): string[] {
  const dir = getSessionL2Dir(projectDir, chatId);
  if (!existsSync(dir)) {
    return [];
  }
  
  let files = readdirSync(dir);
  if (extension) {
    files = files.filter(f => f.endsWith(extension));
  }
  return files;
}
