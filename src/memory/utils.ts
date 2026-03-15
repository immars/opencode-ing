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
