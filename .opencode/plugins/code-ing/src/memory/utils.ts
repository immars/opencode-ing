/**
 * Memory System - Utilities
 *
 * Common file operations for memory modules
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { MEMORY_ROOT_DIR, WORKSPACE_DIR } from './constants.js';

export function getMemoryDir(projectDir: string, subDir: string): string {
  return join(projectDir, MEMORY_ROOT_DIR, subDir);
}

export function ensureMemoryDir(projectDir: string, subDir: string): void {
  const dir = getMemoryDir(projectDir, subDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function getMemoryFilePath(projectDir: string, subDir: string, filename: string): string {
  return join(getMemoryDir(projectDir, subDir), filename);
}

export function readMemoryFile(projectDir: string, subDir: string, filename: string): string {
  const filePath = getMemoryFilePath(projectDir, subDir, filename);
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

export function fileExists(projectDir: string, subDir: string, filename: string): boolean {
  return existsSync(getMemoryFilePath(projectDir, subDir, filename));
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
