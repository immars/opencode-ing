/**
 * code-ing Memory Management Module
 * 
 * 负责：
 * 1. 读取配置文件
 * 2. 短期记忆写入
 * 3. 长期记忆读取
 * 4. Context 组装
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";

// 工作目录根目录
const CODE_ING_DIR = ".code-ing";

export interface AgentConfig {
  agent: {
    name: string;
    trigger: string;
  };
  memory: {
    short_term: {
      max_sessions: number;
    };
    long_term: {
      consolidation_threshold: number;
    };
  };
  llm: {
    model: string;
  };
  log_level: string;
}

export interface FeishuConfig {
  app_id: string;
  app_secret: string;
  message: {
    poll_interval: number;
    group_ids: string[];
  };
  webhook: {
    enabled: boolean;
  };
}

export interface MemoryContext {
  directoryInfo: string;
  longTermMemory: string;
  shortTermMemory: string;
}

/**
 * 获取 .code-ing 目录的绝对路径
 */
export function getCodeIngPath(projectDir: string): string {
  return join(projectDir, CODE_ING_DIR);
}

/**
 * 读取 Agent 配置
 */
export function loadAgentConfig(projectDir: string): AgentConfig | null {
  const configPath = join(getCodeIngPath(projectDir), "config", "agent.yaml");
  
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(configPath, "utf-8");
    return parseYaml(content) as AgentConfig;
  } catch (e) {
    console.error("Failed to load agent config:", e);
    return null;
  }
}

/**
 * 读取飞书配置
 */
export function loadFeishuConfig(projectDir: string): FeishuConfig | null {
  const configPath = join(getCodeIngPath(projectDir), "config", "feishu.yaml");
  
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(configPath, "utf-8");
    return parseYaml(content) as FeishuConfig;
  } catch (e) {
    console.error("Failed to load feishu config:", e);
    return null;
  }
}

/**
 * 写入短期记忆
 */
export function writeShortTermMemory(
  projectDir: string,
  sessionId: string,
  content: string
): void {
  const sessionsDir = join(
    getCodeIngPath(projectDir),
    "workspace",
    "short-term",
    "sessions"
  );
  
  // 确保目录存在
  if (!existsSync(sessionsDir)) {
    mkdirSync(sessionsDir, { recursive: true });
  }
  
  const sessionFile = join(sessionsDir, `${sessionId}.md`);
  
  // 如果文件已存在，追加内容
  if (existsSync(sessionFile)) {
    const existing = readFileSync(sessionFile, "utf-8");
    writeFileSync(sessionFile, `${existing}\n\n---\n\n${content}`);
  } else {
    // 新建文件
    writeFileSync(sessionFile, content);
  }
}

/**
 * 读取短期记忆
 */
export function readShortTermMemory(
  projectDir: string,
  sessionId: string
): string {
  const sessionFile = join(
    getCodeIngPath(projectDir),
    "workspace",
    "short-term",
    "sessions",
    `${sessionId}.md`
  );
  
  if (!existsSync(sessionFile)) {
    return "";
  }
  
  return readFileSync(sessionFile, "utf-8");
}

/**
 * 读取所有短期记忆文件
 */
export function readAllShortTermMemory(projectDir: string): string {
  const sessionsDir = join(
    getCodeIngPath(projectDir),
    "workspace",
    "short-term",
    "sessions"
  );
  
  if (!existsSync(sessionsDir)) {
    return "";
  }
  
  const files = readdirSync(sessionsDir).filter(f => f.endsWith(".md"));
  const contents: string[] = [];
  
  for (const file of files) {
    const content = readFileSync(join(sessionsDir, file), "utf-8");
    contents.push(`## ${file.replace(".md", "")}\n\n${content}`);
  }
  
  return contents.join("\n\n---\n\n");
}

/**
 * 读取长期记忆
 */
export function readLongTermMemory(projectDir: string): string {
  const longTermDir = join(getCodeIngPath(projectDir), "workspace", "long-term");
  
  if (!existsSync(longTermDir)) {
    return "";
  }
  
  const files = readdirSync(longTermDir).filter(f => f.endsWith(".md"));
  const contents: string[] = [];
  
  for (const file of files) {
    const content = readFileSync(join(longTermDir, file), "utf-8");
    contents.push(`## ${file.replace(".md", "")}\n\n${content}`);
  }
  
  return contents.join("\n\n---\n\n");
}

/**
 * 写入长期记忆
 */
export function writeLongTermMemory(
  projectDir: string,
  filename: string,
  content: string
): void {
  const longTermDir = join(getCodeIngPath(projectDir), "workspace", "long-term");
  
  // 确保目录存在
  if (!existsSync(longTermDir)) {
    mkdirSync(longTermDir, { recursive: true });
  }
  
  const filePath = join(longTermDir, filename);
  writeFileSync(filePath, content);
}

/**
 * 构建记忆 Context
 */
export function buildMemoryContext(
  projectDir: string,
  sessionId: string
): MemoryContext {
  // 目录结构信息
  const directoryInfo = `
## 你的记忆目录结构
.code-ing/
├── config/                    # 配置文件
│   ├── feishu.yaml           # 飞书凭证配置
│   └── agent.yaml            # Agent 运行时配置
└── workspace/
    ├── short-term/sessions/  # 短期记忆（当前会话）
    │   └── {session-id}.md
    └── long-term/            # 长期记忆（重要信息）
`;
  
  // 长期记忆
  const longTermMemory = readLongTermMemory(projectDir);
  
  // 短期记忆（当前会话）
  const shortTermMemory = readShortTermMemory(projectDir, sessionId);
  
  return {
    directoryInfo,
    longTermMemory: longTermMemory || "（暂无长期记忆）",
    shortTermMemory: shortTermMemory || "（当前会话刚开始）",
  };
}

/**
 * 简单的 YAML 解析（仅支持基本键值对）
 */
function parseYaml(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = content.split("\n");
  let currentKey = "";
  let currentObj: Record<string, any> = result;
  const stack: Record<string, any>[] = [];
  
  for (const line of lines) {
    // 跳过注释和空行
    if (line.trim().startsWith("#") || !line.trim()) continue;
    
    // 检查缩进级别
    const indent = line.search(/\S/);
    
    // 处理键值对
    const match = line.match(/^(\s*)(\w+):\s*(.*)$/);
    if (match) {
      const [, , key, value] = match;
      
      if (indent === 0) {
        // 顶级键
        if (value.trim()) {
          result[key] = value.trim().replace(/['"]/g, "");
        } else {
          result[key] = {};
          currentObj = result[key];
        }
        currentKey = key;
      } else if (indent === 2) {
        // 二级键
        if (value.trim()) {
          currentObj[key] = value.trim().replace(/['"]/g, "");
        } else {
          currentObj[key] = {};
        }
      }
    }
  }
  
  return result;
}

export default {
  getCodeIngPath,
  loadAgentConfig,
  loadFeishuConfig,
  writeShortTermMemory,
  readShortTermMemory,
  readAllShortTermMemory,
  readLongTermMemory,
  writeLongTermMemory,
  buildMemoryContext,
};
