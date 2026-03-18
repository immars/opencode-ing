import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { WORKSPACE_DIR } from './memory/constants.js'
import { logger } from './logger.js'

export interface Contact {
  chatId: string
  lastSeen: string
  type: 'group' | 'user'
  name?: string
}

function getContactsPath(projectDir: string): string {
  return join(projectDir, WORKSPACE_DIR, 'memory', 'contacts.json')
}

export function loadContacts(projectDir: string): Contact[] {
  const contactsPath = getContactsPath(projectDir)
  if (!existsSync(contactsPath)) {
    return []
  }
  try {
    const content = readFileSync(contactsPath, 'utf-8')
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
  } catch {
    return []
  }
}

export function findContact(projectDir: string, chatId: string): Contact | null {
  const contacts = loadContacts(projectDir)
  return contacts.find((c) => c.chatId === chatId) || null
}

export function saveContact(
  projectDir: string,
  chatId: string,
  chatType: 'p2p' | 'group',
  name?: string
): void {
  const contactsPath = getContactsPath(projectDir)
  const contactsDir = dirname(contactsPath)

  const contacts = loadContacts(projectDir)

  const existingIndex = contacts.findIndex((c) => c.chatId === chatId)
  const existingContact = existingIndex >= 0 ? contacts[existingIndex] : null
  
  const newContact: Contact = {
    chatId,
    lastSeen: new Date().toISOString(),
    type: chatType === 'group' ? 'group' : 'user',
    // 保留已有名字，除非传入新名字
    name: name || existingContact?.name,
  }

  if (existingIndex >= 0) {
    contacts[existingIndex] = newContact
  } else {
    contacts.unshift(newContact)
  }

  const trimmed = contacts.slice(0, 100)

  if (!existsSync(contactsDir)) {
    mkdirSync(contactsDir, { recursive: true })
  }

  try {
    writeFileSync(contactsPath, JSON.stringify(trimmed, null, 2))
  } catch (err) {
    logger.error('Contacts', 'Failed to save contacts:', err)
  }
}
