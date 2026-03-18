/**
 * 文件处理模块
 * 
 * 处理飞书消息中的文件部分：下载、保存、格式化
 */

import { downloadMessageFile } from '../feishu.js';
import { saveFileToSession, type FileMetadata } from '../memory/files.js';
import { logger } from '../logger.js';

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

export interface MessageHandlerDeps {
  client: any;
  directory: string;
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

async function processPostMessage(
  deps: MessageHandlerDeps,
  message: MessageData,
  content: any
): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  if (!content || !Array.isArray(content.content)) return files;

  for (const paragraph of content.content) {
    if (!Array.isArray(paragraph)) continue;
    for (const element of paragraph) {
      if (element.tag === 'img' && element.image_key) {
        const fileInfo = await processImageMessage(deps, message, { image_key: element.image_key });
        if (fileInfo) {
          files.push(fileInfo);
        }
      }
    }
  }
  
  return files;
}

/**
 * 处理消息中的文件部分
 * 
 * 支持的消息类型: image, file, audio, media, post
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
    let parsedContent: any;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      return { success: false, files: [], formattedContent: '', error: 'Invalid JSON content' };
    }
    
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
      
      case 'post': {
        const postFiles = await processPostMessage(deps, message, parsedContent);
        files.push(...postFiles);
        break;
      }
      
      default:
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
