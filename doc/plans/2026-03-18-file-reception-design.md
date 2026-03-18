# 文件接收功能设计文档

> Date: 2026-03-18
> Status: Approved

## 概述

为 OpenCode-ing Agent 添加文件接收功能，支持从飞书接收用户发送的图片、PDF、Office 文档、文本/代码文件等。

## 需求

- **用户期望**：发送文件后，Assistant 保存文件 + 分析内容并回复
- **支持文件类型**：图片、PDF、Office 文档 (Word/Excel/PPT)、文本/代码文件
- **分析方式**：利用 opencode 现有 skill (pdf, xlsx, docx 等)
- **混合消息**：如果消息同时包含文本和文件，将文件路径注入文本后一起发送给 LLM

## 文件存储结构

```
.code-ing/
└── memory/
    └── sessions/
        └── {chat_id}/
            ├── L0/
            ├── L1/
            ├── L2/
            └── files/
                ├── 2026-03-18_143025_report.pdf
                ├── 2026-03-18_143026_image.jpg
                └── metadata.json
```

**命名规则**：`{YYYY-MM-DD}_{HHmmss}_{原文件名}`

**元数据结构** (`metadata.json`)：
```json
{
  "files": [
    {
      "timestamp": "2026-03-18_143025",
      "original_name": "report.pdf",
      "saved_name": "2026-03-18_143025_report.pdf",
      "message_id": "om_xxx",
      "file_key": "file_xxx",
      "type": "file",
      "size": 102400,
      "local_path": ".code-ing/memory/sessions/oc_xxx/files/2026-03-18_143025_report.pdf"
    }
  ]
}
```

## 消息处理流程

### 消息类型分流

```
收到飞书消息
    ↓
判断 message_type
    ↓
├─ text        → 现有文本处理逻辑
├─ image       → 下载 → 保存 → 注入路径 → 发送给 LLM
├─ file        → 下载 → 保存 → 注入路径 → 发送给 LLM
├─ audio       → 下载 → 保存 → 注入路径 → 发送给 LLM
├─ media       → 下载 → 保存 → 注入路径 → 发送给 LLM
└─ post        → 解析富文本 → 提取图片 → 下载保存 → 注入路径 → 发送给 LLM
```

### 混合消息处理

用户发送 "帮我看看这个" + 图片：

1. 下载图片到 `files/` 目录
2. 生成格式化文本：
   ```
   帮我看看这个
   
   ---
   [图片: screenshot.png]
   路径: .code-ing/memory/sessions/oc_xxx/files/2026-03-18_143025_screenshot.png
   ---
   ```
3. 将组合后的消息发送给 LLM

### 文件格式化模板

**图片**：
```
[图片: {fileName}]
路径: {localPath}
```

**文件**：
```
[附件: {fileName}]
类型: {fileType}
路径: {localPath}
大小: {size}
```

## 代码结构

### 新增文件

```
src/
├── agent/
│   └── file-handler.ts    # 新增：文件处理模块
└── memory/
    └── files.ts           # 新增：文件存储管理
```

### 修改文件

```
src/
├── feishu.ts              # 添加 downloadMessageFile 函数
└── agent/
    └── message-handler.ts # 添加文件类型判断和分流
```

### 模块职责

#### `src/feishu.ts` - 新增函数

```typescript
/**
 * 下载消息中的文件资源
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
): Promise<Buffer | null>
```

#### `src/memory/files.ts` - 新增模块

```typescript
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

/**
 * 保存文件到对话目录
 * @returns 本地保存路径
 */
export function saveFileToSession(
  projectDir: string,
  chatId: string,
  fileName: string,
  fileBuffer: Buffer,
  metadata: Omit<FileMetadata, 'saved_name' | 'local_path' | 'timestamp'>
): string;

/**
 * 更新元数据文件
 */
export function updateFileMetadata(
  projectDir: string,
  chatId: string,
  metadata: FileMetadata
): void;

/**
 * 获取对话的文件列表
 */
export function getSessionFiles(
  projectDir: string,
  chatId: string
): FileMetadata[];

/**
 * 获取对话文件目录路径
 */
export function getSessionFilesDir(
  projectDir: string,
  chatId: string
): string;
```

#### `src/agent/file-handler.ts` - 新增模块

```typescript
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
}

/**
 * 处理消息中的文件部分
 * - 下载文件
 * - 保存到本地
 * - 生成格式化文本
 */
export async function processMessageFiles(
  deps: MessageHandlerDeps,
  message: {
    message_id: string;
    message_type: string;
    content: string;
  }
): Promise<FileProcessResult>;
```

#### `src/agent/message-handler.ts` - 修改

```typescript
// 在 handleFeishuMessage 中添加类型判断

const msgType = msg.message?.message_type;

// 1. 检查是否有文件
if (['image', 'file', 'audio', 'media', 'post'].includes(msgType)) {
  const fileResult = await processMessageFiles(deps, msg.message);
  
  if (fileResult.files.length > 0) {
    // 有文件，组合文本和文件信息
    const textContent = parseFeishuMessageContent(rawContent);
    const enhancedContent = textContent 
      ? textContent + '\n\n' + fileResult.formattedContent
      : fileResult.formattedContent;
    
    // 使用 enhancedContent 替代原来的 textContent 继续处理
    // ...
  }
}

// 2. 纯文本消息走现有逻辑
```

## 飞书 API 参考

### 消息类型判断

- `message_type` 字段：`text`, `image`, `file`, `audio`, `media`, `post`

### 消息内容结构

**图片消息**：
```json
{
  "message_type": "image",
  "content": "{\"image_key\":\"img_xxx\"}"
}
```

**文件消息**：
```json
{
  "message_type": "file",
  "content": "{\"file_key\":\"file_xxx\",\"file_name\":\"report.pdf\"}"
}
```

### 文件下载 API

```typescript
const response = await client.im.messageResource.get({
  path: {
    message_id: message.message_id,
    file_key: fileKey,
  },
  params: {
    type: 'image', // 或 'file'
  },
});

// response.data 是 Buffer
```

### 权限要求

- `im:resource` - 上传/下载图片与文件（必须）

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| 文件下载失败 | 记录日志，回复用户"文件下载失败，请重试" |
| 文件过大 (>100MB) | 回复用户"文件超过 100MB 限制" |
| 不支持的消息类型 | 跳过，按普通文本处理 |
| 保存文件失败 | 记录日志，回复用户"文件保存失败" |

## 测试计划

1. **单元测试**：
   - `files.ts` 的保存和元数据管理
   - `file-handler.ts` 的格式化逻辑

2. **集成测试**：
   - 发送纯图片消息
   - 发送纯文件消息
   - 发送带图片的富文本消息
   - 发送多个附件

3. **端到端测试**：
   - 从飞书客户端发送文件，验证完整流程
