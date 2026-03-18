# 文件接收功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 OpenCode-ing Agent 添加从飞书接收文件（图片、PDF、Office文档等）并分析的能力。

**Architecture:** 
1. 在 feishu.ts 添加文件下载函数，调用飞书 `im.messageResource.get` API
2. 新增 memory/files.ts 管理文件存储和元数据
3. 新增 agent/file-handler.ts 处理文件消息的下载、保存和格式化
4. 修改 message-handler.ts 分流文件消息并注入文件路径到用户消息中

**Tech Stack:** TypeScript, Node.js, @larksuiteoapi/node-sdk

**Design Doc:** `doc/plans/2026-03-18-file-reception-design.md`

---

## Task 1: 添加飞书文件下载函数

**Files:**
- Modify: `src/feishu.ts`

**Step 1: 添加类型定义**

在 `src/feishu.ts` 的 Types & Interfaces 部分添加：

```typescript
export interface DownloadedFile {
  buffer: Buffer;
  fileName?: string;
  contentType?: string;
}
```

**Step 2: 添加文件下载函数**

在 `// ============================================================================` 注释分隔的 "File Management" 部分添加：

```typescript
/**
 * 下载消息中的文件资源
 * @param projectDir - 项目目录
 * @param messageId - 消息 ID
 * @param fileKey - 文件/图片的唯一标识
 * @param type - 资源类型: 'image' 或 'file'
 * @returns 文件 Buffer 或 null
 */
export async function downloadMessageFile(
  projectDir: string,
  messageId: string,
  fileKey: string,
  type: 'image' | 'file'
): Promise<DownloadedFile | null> {
  const result = await withLarkClient(projectDir, async (c) => {
    const response = await c.im.messageResource.get({
      path: {
        message_id: messageId,
        file_key: fileKey,
      },
      params: {
        type: type,
      },
    });
    
    return {
      buffer: response.data,
      contentType: response.headers?.['content-type'],
    };
  }, `Failed to download file: ${fileKey}`);
  
  return result;
}
```

**Step 3: 验证编译**

Run: `npm run build`
Expected: 编译成功，无错误

**Step 4: Commit**

```bash
git add src/feishu.ts
git commit -m "feat(feishu): add downloadMessageFile function for file download"
```

---

## Task 2: 创建文件存储管理模块

**Files:**
- Create: `src/memory/files.ts`

**Step 1: 创建 src/memory/files.ts**

```typescript
/**
 * 文件存储管理模块
 * 
 * 管理对话目录下的文件存储和元数据
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../logger.js';

export interface FileMetadata {
  timestamp: string;
  original_name: string;
  saved_name: string;
  message_id: string;
  file_key: string;
  type: 'image' | 'file' | 'audio' | 'media';
  size: number;
  local_path: string;
}

interface MetadataFile {
  files: FileMetadata[];
}

const FILES_DIR = 'files';
const METADATA_FILE = 'metadata.json';

/**
 * 获取对话文件目录路径
 */
export function getSessionFilesDir(
  projectDir: string,
  chatId: string
): string {
  return path.join(projectDir, '.code-ing', 'memory', 'sessions', chatId, FILES_DIR);
}

/**
 * 获取元数据文件路径
 */
function getMetadataPath(projectDir: string, chatId: string): string {
  return path.join(getSessionFilesDir(projectDir, chatId), METADATA_FILE);
}

/**
 * 确保文件目录存在
 */
async function ensureFilesDir(projectDir: string, chatId: string): Promise<void> {
  const filesDir = getSessionFilesDir(projectDir, chatId);
  try {
    await fs.mkdir(filesDir, { recursive: true });
  } catch (e) {
    logger.error('Files', `Failed to create files directory: ${filesDir}`, e);
  }
}

/**
 * 读取元数据文件
 */
async function readMetadata(projectDir: string, chatId: string): Promise<MetadataFile> {
  const metadataPath = getMetadataPath(projectDir, chatId);
  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { files: [] };
  }
}

/**
 * 写入元数据文件
 */
async function writeMetadata(
  projectDir: string,
  chatId: string,
  metadata: MetadataFile
): Promise<void> {
  const metadataPath = getMetadataPath(projectDir, chatId);
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

/**
 * 生成保存的文件名
 * 格式: YYYY-MM-DD_HHmmss_originalName
 */
function generateSavedFileName(originalName: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const timestamp = `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
  
  // 清理原始文件名中的特殊字符
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  return `${timestamp}_${safeName}`;
}

/**
 * 保存文件到对话目录
 * @returns 本地保存路径（相对路径）
 */
export async function saveFileToSession(
  projectDir: string,
  chatId: string,
  fileName: string,
  fileBuffer: Buffer,
  metadata: Omit<FileMetadata, 'saved_name' | 'local_path' | 'timestamp' | 'size'>
): Promise<string> {
  await ensureFilesDir(projectDir, chatId);
  
  const savedName = generateSavedFileName(fileName);
  const filesDir = getSessionFilesDir(projectDir, chatId);
  const fullPath = path.join(filesDir, savedName);
  
  await fs.writeFile(fullPath, fileBuffer);
  
  // 构建相对路径（从 sessions/{chatId}/ 开始）
  const relativePath = path.join('.code-ing', 'memory', 'sessions', chatId, FILES_DIR, savedName);
  
  // 更新元数据
  const fullMetadata: FileMetadata = {
    ...metadata,
    saved_name: savedName,
    size: fileBuffer.length,
    local_path: relativePath,
    timestamp: new Date().toISOString(),
  };
  
  await updateFileMetadata(projectDir, chatId, fullMetadata);
  
  logger.info('Files', `File saved: ${relativePath}`);
  
  return relativePath;
}

/**
 * 更新元数据文件
 */
export async function updateFileMetadata(
  projectDir: string,
  chatId: string,
  metadata: FileMetadata
): Promise<void> {
  const metadataFile = await readMetadata(projectDir, chatId);
  metadataFile.files.push(metadata);
  await writeMetadata(projectDir, chatId, metadataFile);
}

/**
 * 获取对话的文件列表
 */
export async function getSessionFiles(
  projectDir: string,
  chatId: string
): Promise<FileMetadata[]> {
  const metadataFile = await readMetadata(projectDir, chatId);
  return metadataFile.files;
}
```

**Step 2: 验证编译**

Run: `npm run build`
Expected: 编译成功，无错误

**Step 3: Commit**

```bash
git add src/memory/files.ts
git commit -m "feat(memory): add files.ts for file storage and metadata management"
```

---

## Task 3: 创建文件处理模块

**Files:**
- Create: `src/agent/file-handler.ts`

**Step 1: 创建 src/agent/file-handler.ts**

```typescript
/**
 * 文件处理模块
 * 
 * 处理飞书消息中的文件部分：下载、保存、格式化
 */

import { downloadMessageFile } from '../feishu.js';
import { saveFileToSession, type FileMetadata } from '../memory/files.js';
import { logger } from '../logger.js';
import type { MessageHandlerDeps } from './message-handler.js';

export interface FileInfo {
  type: 'image' | 'file' | 'audio' | 'media';
  localPath: string;
  originalName: string;
  size: number;
}

export interface FileProcessResult {
  success: boolean;
  files: FileInfo[];
  formattedContent: string;
  error?: string;
}

interface MessageData {
  message_id: string;
  message_type: string;
  content: string;
  chat_id?: string;
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 格式化单个文件信息
 */
function formatFileInfo(file: FileInfo): string {
  if (file.type === 'image') {
    return `[图片: ${file.originalName}]\n路径: ${file.localPath}`;
  }
  
  return [
    `[附件: ${file.originalName}]`,
    `类型: ${file.type}`,
    `路径: ${file.localPath}`,
    `大小: ${formatSize(file.size)}`,
  ].join('\n');
}

/**
 * 格式化多个文件信息
 */
function formatMultipleFiles(files: FileInfo[]): string {
  if (files.length === 0) return '';
  if (files.length === 1) return formatFileInfo(files[0]);
  
  const formatted = files.map((f, i) => {
    const info = formatFileInfo(f);
    return `---\n[附件 ${i + 1}]\n${info}\n---`;
  });
  
  return '\n' + formatted.join('\n');
}

/**
 * 处理图片消息
 */
async function processImageMessage(
  deps: MessageHandlerDeps,
  message: MessageData,
  content: { image_key: string }
): Promise<FileInfo | null> {
  const { directory } = deps;
  const chatId = message.chat_id;
  
  if (!chatId) {
    logger.error('FileHandler', 'No chat_id in image message');
    return null;
  }
  
  const downloadResult = await downloadMessageFile(
    directory,
    message.message_id,
    content.image_key,
    'image'
  );
  
  if (!downloadResult || !downloadResult.buffer) {
    logger.error('FileHandler', `Failed to download image: ${content.image_key}`);
    return null;
  }
  
  // 从 contentType 推断扩展名
  let ext = 'jpg';
  if (downloadResult.contentType) {
    if (downloadResult.contentType.includes('png')) ext = 'png';
    else if (downloadResult.contentType.includes('gif')) ext = 'gif';
    else if (downloadResult.contentType.includes('webp')) ext = 'webp';
  }
  
  const fileName = `image.${ext}`;
  
  const localPath = await saveFileToSession(
    directory,
    chatId,
    fileName,
    downloadResult.buffer,
    {
      original_name: fileName,
      message_id: message.message_id,
      file_key: content.image_key,
      type: 'image',
    }
  );
  
  return {
    type: 'image',
    localPath,
    originalName: fileName,
    size: downloadResult.buffer.length,
  };
}

/**
 * 处理文件消息 (file/audio/media)
 */
async function processFileMessage(
  deps: MessageHandlerDeps,
  message: MessageData,
  content: { file_key: string; file_name?: string },
  msgType: 'file' | 'audio' | 'media'
): Promise<FileInfo | null> {
  const { directory } = deps;
  const chatId = message.chat_id;
  
  if (!chatId) {
    logger.error('FileHandler', 'No chat_id in file message');
    return null;
  }
  
  const downloadResult = await downloadMessageFile(
    directory,
    message.message_id,
    content.file_key,
    'file'
  );
  
  if (!downloadResult || !downloadResult.buffer) {
    logger.error('FileHandler', `Failed to download file: ${content.file_key}`);
    return null;
  }
  
  const fileName = content.file_name || `file_${content.file_key}`;
  
  const localPath = await saveFileToSession(
    directory,
    chatId,
    fileName,
    downloadResult.buffer,
    {
      original_name: fileName,
      message_id: message.message_id,
      file_key: content.file_key,
      type: msgType,
    }
  );
  
  return {
    type: msgType,
    localPath,
    originalName: fileName,
    size: downloadResult.buffer.length,
  };
}

/**
 * 处理消息中的文件部分
 * 
 * 支持的消息类型: image, file, audio, media
 * 
 * @returns 处理结果，包含文件信息和格式化后的内容
 */
export async function processMessageFiles(
  deps: MessageHandlerDeps,
  message: MessageData
): Promise<FileProcessResult> {
  const { message_type, content } = message;
  const files: FileInfo[] = [];
  
  try {
    // 解析 content JSON
    let parsedContent: any;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      return { success: false, files: [], formattedContent: '', error: 'Invalid JSON content' };
    }
    
    // 根据消息类型处理
    switch (message_type) {
      case 'image': {
        const fileInfo = await processImageMessage(deps, message, parsedContent);
        if (fileInfo) files.push(fileInfo);
        break;
      }
      
      case 'file':
      case 'audio':
      case 'media': {
        const fileInfo = await processFileMessage(deps, message, parsedContent, message_type);
        if (fileInfo) files.push(fileInfo);
        break;
      }
      
      default:
        // 不支持的类型，返回空结果
        return { success: true, files: [], formattedContent: '' };
    }
    
    const formattedContent = formatMultipleFiles(files);
    
    return {
      success: true,
      files,
      formattedContent,
    };
    
  } catch (e) {
    logger.error('FileHandler', 'Error processing file message:', e);
    return {
      success: false,
      files,
      formattedContent: '',
      error: String(e),
    };
  }
}
```

**Step 2: 验证编译**

Run: `npm run build`
Expected: 编译成功，无错误

**Step 3: Commit**

```bash
git add src/agent/file-handler.ts
git commit -m "feat(agent): add file-handler.ts for file message processing"
```

---

## Task 4: 修改消息处理器支持文件消息

**Files:**
- Modify: `src/agent/message-handler.ts`

**Step 1: 添加导入**

在文件顶部添加导入：

```typescript
import { processMessageFiles } from './file-handler.js';
```

**Step 2: 修改 handleFeishuMessage 函数**

在 `handleFeishuMessage` 函数中，修改消息处理逻辑。找到 `const textContent = parseFeishuMessageContent(rawContent);` 这一行，将其替换为：

```typescript
  const msgType = msg.message?.message_type;
  const rawContent = msg.message?.content || '';
  
  // 处理文件类型消息
  let textContent = '';
  
  if (['image', 'file', 'audio', 'media'].includes(msgType)) {
    // 文件消息：下载文件并格式化
    const fileResult = await processMessageFiles(deps, {
      message_id: messageId || '',
      message_type: msgType,
      content: rawContent,
      chat_id: chatId,
    });
    
    if (fileResult.success && fileResult.files.length > 0) {
      textContent = fileResult.formattedContent;
    } else if (!fileResult.success) {
      logger.error('MessageHandler', 'File processing failed:', fileResult.error);
    }
  } else {
    // 文本消息：解析文本内容
    textContent = parseFeishuMessageContent(rawContent);
  }
```

**Step 3: 完整的修改位置**

修改后的 `handleFeishuMessage` 函数开头应该类似这样：

```typescript
export async function handleFeishuMessage(
  deps: MessageHandlerDeps,
  msg: any
): Promise<void> {
  const { client, directory } = deps;

  const chatId = msg.message?.chat_id;
  const chatType = msg.message?.chat_type;
  const messageId = msg.message?.message_id;
  const msgType = msg.message?.message_type;
  const rawContent = msg.message?.content || '';
  const senderId = msg.sender?.sender_id?.open_id;
  const senderName = msg.sender?.sender?.tenant_key;

  // 处理文件类型消息
  let textContent = '';
  
  if (['image', 'file', 'audio', 'media'].includes(msgType)) {
    // 文件消息：下载文件并格式化
    const fileResult = await processMessageFiles(deps, {
      message_id: messageId || '',
      message_type: msgType,
      content: rawContent,
      chat_id: chatId,
    });
    
    if (fileResult.success && fileResult.files.length > 0) {
      textContent = fileResult.formattedContent;
    } else if (!fileResult.success) {
      logger.error('MessageHandler', 'File processing failed:', fileResult.error);
    }
  } else {
    // 文本消息：解析文本内容
    textContent = parseFeishuMessageContent(rawContent);
  }

  if (!textContent || !chatId) return;
  
  // ... 后续代码保持不变
```

**Step 4: 验证编译**

Run: `npm run build`
Expected: 编译成功，无错误

**Step 5: Commit**

```bash
git add src/agent/message-handler.ts
git commit -m "feat(agent): integrate file handling into message-handler"
```

---

## Task 5: 添加 Tool 供 LLM 获取文件列表

**Files:**
- Modify: `src/tools.ts`

**Step 1: 添加导入**

在 `src/tools.ts` 顶部添加：

```typescript
import { getSessionFiles } from './memory/files.js';
```

**Step 2: 添加新 tool**

在 `createTools` 函数的 return 对象中添加：

```typescript
    'code-ing.list-files': tool({
      description: '列出当前对话中接收到的所有文件',
      args: {
        chat_id: tool.schema.string().optional().describe('对话ID，默认为当前对话'),
      },
      async execute(args, context) {
        let targetChatId: string | undefined = args.chat_id;
        
        if (!targetChatId && client && context.sessionID) {
          const chatId = await getChatIdFromSession(client, context.sessionID);
          targetChatId = chatId ?? undefined;
        }
        
        if (!targetChatId) {
          return '无法确定目标对话ID';
        }
        
        const files = await getSessionFiles(directory, targetChatId);
        
        if (files.length === 0) {
          return '当前对话中没有文件';
        }
        
        const fileList = files.map((f, i) => 
          `${i + 1}. [${f.type}] ${f.original_name}\n   路径: ${f.local_path}\n   大小: ${f.size} bytes`
        ).join('\n\n');
        
        return `当前对话中的文件 (${files.length} 个):\n\n${fileList}`;
      },
    }),
```

**Step 3: 验证编译**

Run: `npm run build`
Expected: 编译成功，无错误

**Step 4: Commit**

```bash
git add src/tools.ts
git commit -m "feat(tools): add code-ing.list-files tool"
```

---

## Task 6: 最终验证和清理

**Step 1: 完整构建测试**

Run: `npm run build`
Expected: 编译成功，无错误

**Step 2: 类型检查**

Run: `npm run typecheck`
Expected: 无类型错误

**Step 3: 查看改动**

Run: `git status`
Run: `git diff main --stat`

**Step 4: 最终 Commit (如果有遗漏的文件)**

```bash
git add -A
git commit -m "feat: complete file reception feature implementation"
```

---

## 实现后测试清单

1. **编译测试**: `npm run build` 无错误
2. **类型检查**: `npm run typecheck` 无错误
3. **功能测试**（需要飞书环境）:
   - 发送纯文本消息 → 正常处理
   - 发送单张图片 → 下载保存，路径注入消息
   - 发送 PDF 文件 → 下载保存，路径注入消息
   - 发送 Word/Excel 文件 → 下载保存，路径注入消息
4. **文件存储验证**:
   - 检查 `.code-ing/memory/sessions/{chat_id}/files/` 目录
   - 检查 `metadata.json` 内容

---

## 权限提醒

在飞书开放平台确保已开通以下权限：
- `im:resource` - 上传/下载图片与文件（必须）
- `im:message:readonly` - 读取消息
- `im:message.p2p_msg:readonly` - 接收单聊消息
- `im:message.group_at_msg:readonly` - 接收群聊 @ 消息
