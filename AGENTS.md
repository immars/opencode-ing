# AGENTS.md - OpenCode-ing Project Guidelines

> This document provides guidance for AI coding agents working in this repository.

## Project Overview

OpenCode-ing is a long-running autonomous AI agent that integrates with Feishu (飞书) messaging platform. It features:
- Persistent memory system (L0/L1/L2/L9 levels)
- Feishu WebSocket integration for real-time messaging
- Scheduled task execution
- Session management

**Tech Stack**: TypeScript (ES modules), Node.js, @larksuiteoapi/node-sdk, zod, @opencode-ai/plugin

important reference: 

- [opencode plugin/api](https://github.com/anomalyco/opencode)
- [feishu sdk](https://github.com/larksuite/node-sdk)
  

---

## Build / Development Commands

每次完成需求的开发或者问题修复，需要验证以后再告诉用户。

```bash
# Build TypeScript
npm run build          # Compile TypeScript to dist/
npm run dev            # Watch mode for development

# Type check only (no emit)
npm run typecheck

# Run the plugin (via OpenCode)
# Start opencode in the project root directory
opencode
```

**Note**: This project does not have a test suite or linter configured yet. The primary validation is TypeScript compilation.

---

## Project Structure

```
opencode-ing/
├── src/                    # Plugin source code (TypeScript)
│   ├── index.ts            # Plugin entry point
│   ├── config.ts           # Configuration loading
│   ├── feishu.ts           # Feishu SDK integration
│   ├── tools.ts            # OpenCode tool definitions
│   ├── scheduler.ts        # Task scheduling
│   ├── memory.ts           # Memory system facade
│   ├── agent/              # Agent-specific modules
│   └── memory/             # Memory system (L0/L1/L2/L9)
├── dist/                   # Compiled output
├── .opencode/
│   ├── plugins/            # Plugin symlinks
│   ├── skills/             # Project-specific skills
│   └── agents/             # Agent configurations
├── templates/              # Template files for onboarding
├── doc/                    # Documentation
└── .code-ing/              # Runtime workspace (gitignored)
    ├── config/             # feishu.yaml
    └── memory/             # Memory files (L0/L1/L2/L9)
```

---

## TypeScript Configuration

**tsconfig.json** (located at project root):
- Target: ES2022
- Module: ESNext with bundler resolution
- Strict mode enabled
- Declaration files generated
- Output: `dist/`, Source: `src/`

---

## Code Style Guidelines

### Imports

```typescript
// Node.js built-ins (use node: prefix)
import { readFileSync, existsSync } from 'fs';
import path from 'node:path';
import fs from 'node:fs/promises';

// External packages
import type { Plugin, Hooks } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';

// Internal modules (use .js extension for ES modules)
import { loadFeishuConfig } from './config.js';
import type { MessageRecord } from './types.js';
```

**Rules**:
- Use `node:` prefix for Node.js built-in imports
- Include `.js` extension for local imports (required for ES modules)
- Use `import type` for type-only imports
- Group imports: Node.js → External → Internal

### Formatting

- **Indentation**: 2 spaces
- **Strings**: Single quotes preferred, double quotes only when necessary
- **Semicolons**: Required
- **Max line length**: ~100 characters (no strict enforcement)
- **Trailing commas**: Not required for single-line arrays/objects

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables/Functions | camelCase | `loadFeishuConfig`, `recentMessages` |
| Classes/Interfaces | PascalCase | `MessageRecord`, `FeishuConfig` |
| Constants (true constants) | SCREAMING_SNAKE_CASE | `HEARTBEAT_INTERVAL`, `WORKSPACE_DIR` |
| File names | kebab-case | `message-handler.ts`, `sys-inject.ts` |
| YAML config fields | snake_case | `app_id`, `app_secret` |
| Private helper functions | Prefix with underscore or describe purpose | `getOrCreateClient`, `withLarkClient` |

### Types and Interfaces

```typescript
// Prefer explicit interfaces for object shapes
export interface FeishuConfig {
  app_id: string;
  app_secret: string;
  message?: {
    poll_interval?: number;
    group_ids?: string[];
  };
}

// Use union types for limited options
export type TriggerType = 'feishu_message' | 'scheduled';

// Use type for simple aliases
export type MessageRole = 'user' | 'assistant';
```

**Rules**:
- All function parameters and return types should be typed
- Use `interface` for extensible object shapes
- Use `type` for unions, primitives, or when you don't need declaration merging
- Avoid `any` - use `unknown` when type is truly unknown

### Error Handling

```typescript
// Return null on failure (common pattern in this codebase)
export function loadFeishuConfig(projectDir: string): FeishuConfig | null {
  try {
    const content = readFileSync(configPath, 'utf-8');
    return parseYaml(content) as FeishuConfig;
  } catch (e) {
    return null;
  }
}

// Log errors to stderr, not stdout
console.error('[Feishu] Connection check failed:', e);

// Async operations: return null on failure
async function withLarkClient<T>(
  projectDir: string,
  operation: (c: any) => Promise<T>,
  errorMsg?: string
): Promise<T | null> {
  try {
    // ... operation
    return result;
  } catch (e) {
    console.error(errorMsg || "[Feishu] Operation failed:", e);
    return null;
  }
}
```

**Rules**:
- Return `null` for recoverable failures (not throwing)
- Log errors with `[Module]` prefix to stderr
- Use try/catch around file operations and external API calls
- Let TypeScript strict mode catch potential null/undefined issues

### Documentation

```typescript
/**
 * L0 - Message Records Module
 *
 * Handles raw message storage in L0/{date}.md
 */

/**
 * Write a message record to L0/{date}.md
 * @param projectDir - The project directory path
 * @param date - ISO date string (YYYY-MM-DD)
 * @param message - The message record to write
 */
export function writeMessageRecord(
  projectDir: string,
  date: string,
  message: MessageRecord
): void {
  // ...
}
```

**Rules**:
- Add JSDoc comment blocks for modules (at top of file)
- Document public functions with brief description and parameters
- Keep comments concise and actionable

---

## Memory System Architecture

The memory system uses a hierarchical structure for efficient context loading:

| Level | Location | Purpose | Max Size |
|-------|----------|---------|----------|
| L0 | `memory/L0/{date}.md` | Raw message logs | 60 messages |
| L1 | `memory/L1/{date}.md` | Daily summaries | 500 bytes |
| L2 | `memory/L2/{date}.md` | Weekly summaries | 500 bytes |
| L9 | `memory/{SOUL,PEOPLE,TASK,CRON,CRON_SYS}.md` | Long-term memory | Variable |

**Context Injection**:
- Feishu message triggers: L9 files + last 60 L0 messages + 3 L1 days + 3 L2 weeks
- Scheduled triggers: L9 files + matching CRON tasks

---

## Plugin Development

### Creating Tools

```typescript
import { tool } from '@opencode-ai/plugin';

export function createTools(deps: ToolDeps): Record<string, ReturnType<typeof tool>> {
  return {
    'code-ing.my-tool': tool({
      description: 'Tool description',
      args: {
        param1: tool.schema.string().optional(),
      },
      async execute(args, context) {
        // Implementation
        return 'Result string';
      },
    }),
  };
}
```

### Plugin Entry Point

```typescript
import type { Plugin, Hooks } from '@opencode-ai/plugin';

export const codeIng: Plugin = async (ctx): Promise<Hooks> => {
  const { client, directory } = ctx;
  
  // Plugin initialization...
  
  return {
    tool: createTools({ directory, ... }),
  };
};
```

---

## Important Notes

1. **Feishu Integration**: Uses long-polling WebSocket via `@larksuiteoapi/node-sdk`
2. **Session Management**: Managed sessions should be rotated when approaching token limits
3. **Config Files**: `feishu.yaml` contains secrets - never commit with real credentials
4. **Runtime Directory**: `.code-ing/` is gitignored and created at runtime
5. **Chinese Comments**: This project uses both English and Chinese in documentation - prefer Chinese for user-facing content, English for code

---

## Common Tasks

### Adding a new memory level
1. Create module in `src/memory/`
2. Export from `memory/index.ts`
3. Add types to `memory/types.ts`
4. Update `buildMemoryContext()` in main memory module

### Adding a new Feishu feature
1. Add function to `feishu.ts`
2. Use `withLarkClient` helper for API calls
3. Handle errors gracefully (return null/false)

### Adding a new tool
1. Define in `tools.ts` using `tool()` from `@opencode-ai/plugin`
2. Follow naming convention: `code-ing.{action}`
3. Add clear description for the LLM to understand when to use it
