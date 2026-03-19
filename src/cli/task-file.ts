/**
 * Task File Module
 *
 * Handles reading, writing, and validating task files in JSON format.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';

// ============================================================================
// Interfaces
// ============================================================================

export interface TaskFile {
  taskId: string;
  description: string;
  requirements: string[];
  context: {
    files?: string[];
    instructions?: string;
  };
}

export interface TaskResult {
  taskId: string;
  status: 'success' | 'failure' | 'cancelled';
  output: string;
  completedAt: string;
}

// ============================================================================
// Zod Schemas
// ============================================================================

const ContextSchema = z.object({
  files: z.array(z.string()).optional(),
  instructions: z.string().optional(),
});

const TaskFileSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
  description: z.string().min(1, 'description is required'),
  requirements: z.array(z.string()).default([]),
  context: ContextSchema.default({}),
});

const TaskResultSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
  status: z.enum(['success', 'failure', 'cancelled']),
  output: z.string(),
  completedAt: z.string().min(1, 'completedAt is required'),
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a task file object against the TaskFile schema.
 * @param data - The data to validate
 * @returns The validated TaskFile if successful, null otherwise
 */
export function validateTaskFile(data: unknown): TaskFile | null {
  const result = TaskFileSchema.safeParse(data);
  if (!result.success) {
    console.error('[TaskFile] Validation failed:', result.error.message);
    return null;
  }
  return result.data;
}

/**
 * Validate a task result object against the TaskResult schema.
 * @param data - The data to validate
 * @returns The validated TaskResult if successful, null otherwise
 */
export function validateTaskResult(data: unknown): TaskResult | null {
  const result = TaskResultSchema.safeParse(data);
  if (!result.success) {
    console.error('[TaskFile] Result validation failed:', result.error.message);
    return null;
  }
  return result.data;
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Parse and validate a task file from a JSON file path.
 * @param filePath - Path to the task JSON file
 * @returns The validated TaskFile if successful, null otherwise
 */
export function parseTaskFile(filePath: string): TaskFile | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return validateTaskFile(data);
  } catch (e) {
    console.error('[TaskFile] Failed to read or parse file:', e);
    return null;
  }
}

/**
 * Write a task file to the specified path.
 * @param filePath - Path to write the task file
 * @param task - The TaskFile to write
 * @returns true if successful, false otherwise
 */
export function writeTaskFile(filePath: string, task: TaskFile): boolean {
  try {
    const validated = validateTaskFile(task);
    if (!validated) {
      return false;
    }
    const content = JSON.stringify(validated, null, 2);
    writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    console.error('[TaskFile] Failed to write task file:', e);
    return false;
  }
}

/**
 * Write a task result to the specified path.
 * @param filePath - Path to write the result file
 * @param result - The TaskResult to write
 * @returns true if successful, false otherwise
 */
export function writeTaskResult(filePath: string, result: TaskResult): boolean {
  try {
    const validated = validateTaskResult(result);
    if (!validated) {
      return false;
    }
    const content = JSON.stringify(validated, null, 2);
    writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    console.error('[TaskFile] Failed to write task result:', e);
    return false;
  }
}
