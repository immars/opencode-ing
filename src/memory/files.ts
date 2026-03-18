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
