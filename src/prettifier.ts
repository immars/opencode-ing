/**
 * Message Prettifier Module
 * 
 * Cleans and formats messages before sending to Feishu:
 * - Filters system tags
 * - Builds Feishu Interactive Card for full markdown support (including tables)
 * - Supports @mention with <at user_id="open_id">Name</at> format
 */

export const FEISHU_TEXT_LIMIT = 5000;

export function truncateToLimit(content: string, maxChars: number = FEISHU_TEXT_LIMIT): string {
  if (content.length <= maxChars) {
    return content;
  }
  
  const omitted = content.length - maxChars;
  const prefix = `[...省略${omitted}字]\n\n`;
  const targetChars = maxChars - prefix.length;
  const truncatedContent = content.slice(-targetChars);
  
  return prefix + truncatedContent;
}

/**
 * Filter out system tags from message content
 * Removes <dcp-message-id>, <dcp-system-reminder>, <system-reminder> blocks
 */
export function filterSystemTags(content: string): string {
  let result = content;
  
  // Remove <dcp-message-id>...</dcp-message-id> blocks
  result = result.replace(/<dcp-message-id>[\s\S]*?<\/dcp-message-id>/gi, '');
  
  // Remove <dcp-system-reminder>...</dcp-system-reminder> blocks
  result = result.replace(/<dcp-system-reminder[^>]*>[\s\S]*?<\/dcp-system-reminder>/gi, '');
  
  // Remove self-closing or unclosed <dcp-system-reminder> until next tag or double newline
  result = result.replace(/<dcp-system-reminder[^>]*>[\s\S]*?(?=<[a-z]|$)/gi, '');
  
  // Remove any remaining standalone dcp tags
  result = result.replace(/<\/?dcp-[^>]*>/gi, '');
  
  // Remove system-reminder tags
  result = result.replace(/<system-reminder[^>]*>[\s\S]*?<\/system-reminder>/gi, '');
  
  // Clean up multiple consecutive blank lines
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result.trim();
}

// ============================================================================
// Feishu Interactive Card Types
// ============================================================================

/**
 * Feishu Interactive Card Schema 2.0
 * @see https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN
 */
export interface FeishuCard {
  schema: "2.0";
  config: {
    wide_screen_mode: boolean;
  };
  header?: {
    title: {
      tag: "plain_text";
      content: string;
    };
    template?: CardTemplate;
  };
  body: {
    elements: CardElement[];
  };
}

export type CardTemplate = 
  | "blue" | "green" | "red" | "orange" | "purple" 
  | "indigo" | "wathet" | "turquoise" | "yellow" 
  | "grey" | "carmine" | "violet" | "lime";

export type CardElement = 
  | MarkdownElement 
  | DividerElement 
  | NoteElement;

export interface MarkdownElement {
  tag: "markdown";
  content: string;
}

export interface DividerElement {
  tag: "hr";
}

export interface NoteElement {
  tag: "markdown";
  content: string;
}

// ============================================================================
// @Mention Support
// ============================================================================

export interface MentionTarget {
  name: string;
  openId: string;
}

/**
 * Format @mention to Feishu native format
 * Converts @[Name](open_id) → <at user_id="open_id">Name</at>
 * 
 * @example
 * formatMentions("Hello @[Alice](ou_abc123)!")
 * // Returns: "Hello <at user_id=\"ou_abc123\">Alice</at>!"
 */
export function formatMentions(text: string): string {
  // Convert @[Name](open_id) to Feishu native <at> format
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let result = text.replace(mentionPattern, (_match, name: string, openId: string) => {
    return `<at user_id="${openId}">${name}</at>`;
  });
  
  // Also support @user_id:Name format (alternative syntax)
  // @ou_abc123:Alice → <at user_id="ou_abc123">Alice</at>
  const altPattern = /@(ou_[a-zA-Z0-9_-]+):([^\s]+)/g;
  result = result.replace(altPattern, (_match, openId: string, name: string) => {
    return `<at user_id="${openId}">${name}</at>`;
  });
  
  return result;
}

/**
 * Build @mention from structured data
 */
export function buildMention(mentions: MentionTarget[]): string {
  return mentions
    .map(m => `<at user_id="${m.openId}">${m.name}</at>`)
    .join(" ");
}

// ============================================================================
// Card Builders
// ============================================================================

/**
 * Build a simple Feishu Interactive Card with markdown content.
 * Supports full markdown including tables, code blocks, links, etc.
 */
export function buildMarkdownCard(text: string): FeishuCard {
  return {
    schema: "2.0",
    config: {
      wide_screen_mode: true,
    },
    body: {
      elements: [
        {
          tag: "markdown",
          content: text,
        },
      ],
    },
  };
}

/**
 * Header configuration for structured cards
 */
export interface CardHeaderConfig {
  title: string;
  template?: CardTemplate;
}

/**
 * Build a structured Feishu Interactive Card with optional header and note.
 * 
 * @param text - Main markdown content
 * @param options - Optional header and note configuration
 */
export function buildStructuredCard(
  text: string,
  options?: {
    header?: CardHeaderConfig;
    note?: string;
  }
): FeishuCard {
  const elements: CardElement[] = [
    { tag: "markdown", content: text },
  ];
  
  if (options?.note) {
    elements.push({ tag: "hr" });
    elements.push({ 
      tag: "markdown", 
      content: `<font color='grey'>${options.note}</font>` 
    });
  }
  
  const card: FeishuCard = {
    schema: "2.0",
    config: { wide_screen_mode: true },
    body: { elements },
  };
  
  if (options?.header) {
    card.header = {
      title: { tag: "plain_text", content: options.header.title },
      template: options.header.template ?? "blue",
    };
  }
  
  return card;
}

/**
 * Valid card template colors
 */
export const CARD_TEMPLATES = new Set<CardTemplate>([
  "blue", "green", "red", "orange", "purple",
  "indigo", "wathet", "turquoise", "yellow",
  "grey", "carmine", "violet", "lime",
]);

/**
 * Validate and normalize card template
 */
export function resolveCardTemplate(template?: string): CardTemplate | undefined {
  const normalized = template?.trim().toLowerCase();
  if (!normalized || !CARD_TEMPLATES.has(normalized as CardTemplate)) {
    return undefined;
  }
  return normalized as CardTemplate;
}

// ============================================================================
// Main Prettify Function
// ============================================================================

export interface PrettifiedMessage {
  /** Plain text content (for fallback/reference) */
  text: string;
  /** Feishu Interactive Card (for msg_type: "interactive") */
  card: FeishuCard;
  /** Whether content contains markdown formatting */
  hasMarkdown: boolean;
  /** Whether content contains @mentions */
  hasMentions: boolean;
}

/**
 * Check if content has markdown formatting
 */
export function hasMarkdownFormatting(content: string): boolean {
  const patterns = [
    /\[.+\]\(.+\)/,      // Links
    /`.+`/,              // Inline code
    /\*\*.+\*\*/,        // Bold
    /__.+__/,            // Bold (alt)
    /\*.+\*/,            // Italic
    /_.+_/,              // Italic (alt)
    /^```/m,             // Code block
    /^#+ /m,             // Headers
    /^\|.*\|/m,          // Tables
    /^[-*+] /m,          // Lists
    /^> /m,              // Blockquotes
    /<at user_id=/,      // @mentions
    /@\[.+\]\(.+\)/,     // @[Name](open_id) mentions
  ];
  
  return patterns.some(p => p.test(content));
}

/**
 * Check if content has @mentions
 */
export function hasMentions(content: string): boolean {
  return /@\[([^\]]+)\]\(([^)]+)\)/.test(content) || 
         /@(ou_[a-zA-Z0-9_-]+):([^\s]+)/.test(content) ||
         /<at user_id=/.test(content);
}

/**
 * Main prettify function - filters tags, formats mentions, and builds Card.
 * Always returns a Card for consistent markdown rendering.
 */
export function prettifyMessage(content: string): PrettifiedMessage {
  const cleaned = filterSystemTags(content);
  const truncated = truncateToLimit(cleaned);
  const formatted = formatMentions(truncated);
  
  return {
    text: formatted,
    card: buildMarkdownCard(formatted),
    hasMarkdown: hasMarkdownFormatting(truncated),
    hasMentions: hasMentions(truncated),
  };
}

export default {
  filterSystemTags,
  truncateToLimit,
  formatMentions,
  buildMention,
  buildMarkdownCard,
  buildStructuredCard,
  resolveCardTemplate,
  hasMarkdownFormatting,
  hasMentions,
  prettifyMessage,
  FEISHU_TEXT_LIMIT,
  CARD_TEMPLATES,
};
