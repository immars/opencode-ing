# AGENTS.md — Agent Coding Guidelines

This file provides context for agentic coding agents operating in this repository.

## Project Overview

OpenCode-ing is an agent system that runs as an extension of OpenCode. It integrates with Feishu (飞书) for messaging and implements long-running autonomous agents with memory management and self-reflection capabilities.

**Reference Implementation**: This project takes [nanoclaw](https://github.com/horizon-llm/nanoclaw) as a reference. Many patterns and conventions are inspired from there.

**Key Technologies:**

- TypeScript (strict mode)
- Node.js ES modules
- Vitest for testing
- Feishu API integration (via opencode-feishu)

---

## Build, Lint & Test Commands

### Running the Project

```bash
npm run dev          # Run with hot reload (tsx)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled JavaScript
npm run typecheck    # Type check only (tsc --noEmit)
```

### Code Quality

```bash
npm run format       # Format code with Prettier (writes)
npm run format:fix   # Alias for format
npm run format:check # Check formatting without writing
```

### Testing

```bash
npm run test         # Run all tests (vitest run)
npm run test:watch   # Run tests in watch mode
```

**Running a Single Test File:**

```bash
vitest run src/db.test.ts
vitest run src/task-scheduler.test.ts
```

**Running a Single Test:**

```bash
vitest run src/db.test.ts -t "stores a message"
```

---

## Code Style Guidelines

### Imports & Exports

- Use ES modules with `.js` extension in imports:
  ```typescript
  import { something } from './config.js';
  import '../utils.js';
  ```
- Use named exports for all public APIs:
  ```typescript
  export function helperFunction() {}
  export interface Config {}
  ```
- Use `@internal` JSDoc for functions exported only for testing:
  ```typescript
  /** @internal - exported for testing */
  export function _internalHelper() {}
  ```

### TypeScript

- **Strict mode is enabled** — do not use `any`, `@ts-ignore`, or type assertions to bypass errors
- Use explicit return types for public functions:
  ```typescript
  export function processMessage(msg: NewMessage): void {}
  ```
- Use interfaces for object shapes, types for unions/primitives:
  ```typescript
  interface Message {
    id: string;
    content: string;
  }
  type Status = 'active' | 'paused' | 'completed';
  ```

### Naming Conventions

- **Files**: camelCase (`group-queue.ts`, `container-runner.ts`)
- **Interfaces/Types**: PascalCase (`RegisteredGroup`, `Channel`)
- **Functions/Variables**: camelCase (`getMessagesSince`, `lastTimestamp`)
- **Constants**: camelCase or SCREAMING_SNAKE_CASE for config values (`ASSISTANT_NAME`, `POLL_INTERVAL`)

### Formatting

- **Prettier config**: Single quotes enabled, no trailing semicolons
- Run `npm run format` before committing

### Error Handling

- Always log errors with context using the logger:
  ```typescript
  import { logger } from './logger.js';

  try {
    await riskyOperation();
  } catch (err) {
    logger.error({ group: groupName, err }, 'Operation failed');
    // Handle gracefully or re-throw
  }
  ```
- Use empty catch blocks only when intentionally ignoring errors (rare):
  ```typescript
  catch {
    /* column already exists */
  }
  ```

### Logging Patterns

- Use Pino logger with structured logging:
  ```typescript
  logger.info({ key: value }, 'Message');
  logger.warn({ key: value }, 'Warning message');
  logger.error({ key: value, err }, 'Error message');
  logger.debug({ key: value }, 'Debug message');
  ```

---

## Test Patterns

Tests use **Vitest** with the following structure:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('feature name', () => {
  beforeEach(() => {
    // Setup per test
  });

  it('should do something specific', () => {
    const result = someFunction(input);
    expect(result).toBe(expectedValue);
  });
});
```

- Test files: `*.test.ts` in same directory as source

---

## Project Structure

```
src/
├── index.ts           # Main entry point
├── config.ts          # Configuration constants
├── channels/          # Channel adapters (Feishu, etc.)
├── memory/            # Long/short term memory management
├── agent/             # Agent core logic
├── feishu/            # Feishu API integration
└── types.ts           # TypeScript interfaces
```

---

## Common Development Tasks

### Adding a New Channel

1. Create `src/channels/{channel-name}.ts`
2. Implement the `Channel` interface from `./types.js`
3. Export factory function that returns `Channel | null`
4. Import in `src/channels/index.ts` for self-registration

### Adding Memory Management

The agent uses memory for context. See `src/memory/` for existing implementations:
- Short-term: Conversation context within sessions
- Long-term: Persistent storage across sessions

---

## Important Notes

- **No ESLint** — Prettier handles formatting only
- **Strict TypeScript** — No type shortcuts
- **Reference nanoclaw** — For patterns not covered here, check nanoclaw's AGENTS.md
- **Integrates with opencode** — Uses OpenCode's skill system and IPC
