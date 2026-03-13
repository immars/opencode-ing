/**
 * Configuration Module
 *
 * Handles Feishu and agent configuration loading.
 * Extracted from memory/l9.ts to resolve circular dependency.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_DIR } from './memory/constants.js';

export interface FeishuConfig {
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
function parseYaml(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  let currentObj: Record<string, any> = result;

  content.split('\n').forEach((line) => {
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
  const configPath = join(projectDir, WORKSPACE_DIR, 'config', 'feishu.yaml');

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
