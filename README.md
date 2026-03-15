# OpenCode-ing

A long-running autonomous AI agent that integrates with Feishu (飞书) messaging platform, built on top of OpenCode.

## Features

- **Long-running Agent**: Continuously operates as an autonomous agent
- **Feishu Integration**: Real-time messaging via WebSocket through 飞书
- **Hierarchical Memory System**: Multi-level memory architecture (L0/L1/L2/L9) for efficient context management
- **Scheduled Tasks**: Cron-based task scheduling for periodic operations
- **Session Management**: Intelligent session rotation and management

## Quick Start

### Prerequisites

- Node.js 18+
- OpenCode CLI installed

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/opencode-ing.git
   cd opencode-ing
   ```

2. Install dependencies:
   ```bash
   npm install
   npm run build
   ```

3. Start OpenCode in the project root:
   ```bash
   opencode
   ```

4. Run the setup command:
   ```
   /ing-setup
   ```

This will guide you through Feishu authentication, API configuration, and agent startup.

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

## Memory System

The memory system uses a hierarchical structure for efficient context loading:

| Level | Location | Purpose | Max Size |
|-------|----------|---------|----------|
| L0 | `memory/L0/{date}.md` | Raw message logs | 60 messages |
| L1 | `memory/L1/{date}.md` | Daily summaries | 500 bytes |
| L2 | `memory/L2/{date}.md` | Weekly summaries | 500 bytes |
| L9 | `memory/{SOUL,PEOPLE,TASK,CRON,CRON_SYS}.md` | Long-term memory | Variable |

### Context Injection

- **Feishu message triggers**: L9 files + last 60 L0 messages + 3 L1 days + 3 L2 weeks
- **Scheduled triggers**: L9 files + matching CRON tasks

## Development

### Build

```bash
npm run build    # Compile TypeScript
npm run dev      # Watch mode
```

### Type Check

```bash
npm run typecheck
```

## Tech Stack

- **Language**: TypeScript (ES modules)
- **Runtime**: Node.js
- **Feishu SDK**: @larksuiteoapi/node-sdk
- **Validation**: zod
- **Plugin Framework**: @opencode-ai/plugin

## Documentation

- [PRD](doc/PRD.md) - Product requirements
- [Memory Design](doc/memory-design.md) - Memory system architecture
- [Onboarding](doc/onboard.md) - Setup guide
- [Feishu Interaction](doc/feishu-interaction.md) - Feishu integration details
- [AGENTS.md](AGENTS.md) - Development guidelines for AI coding agents

## License

MIT
