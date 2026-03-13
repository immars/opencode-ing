/**
 * Message Prettifier Module
 * 
 * Cleans and formats messages before sending to Feishu:
 * - Filters system tags
 * - Converts markdown to Feishu rich text format
 */

/**
 * Filter out system tags from message content
 * Removes <dcp-system-reminder> and similar system injection tags
 */
export function filterSystemTags(content: string): string {
  // Remove <dcp-system-reminder> tags and their content (until closing tag or end of section)
  let result = content;
  
  // Remove <dcp-system-reminder>...</dcp-system-reminder> blocks
  result = result.replace(/<dcp-system-reminder[^>]*>[\s\S]*?<\/dcp-system-reminder>/gi, '');
  
  // Remove self-closing or unclosed <dcp-system-reminder> until next tag or double newline
  result = result.replace(/<dcp-system-reminder[^>]*>[\s\S]*?(?=<[a-z]|$)/gi, '');
  
  // Remove any remaining standalone dcp tags
  result = result.replace(/<\/?dcp-[^>]*>/gi, '');
  
  // Clean up multiple consecutive blank lines
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result.trim();
}

/**
 * Feishu rich text segment types
 */
interface TextSegment {
  tag: 'text';
  text: string;
  style?: string[];
}

interface LinkSegment {
  tag: 'a';
  text: string;
  href: string;
}

interface CodeSegment {
  tag: 'text';
  text: string;
  style: ['code'];
}

type RichTextSegment = TextSegment | LinkSegment | CodeSegment;

/**
 * Convert markdown to Feishu rich text post format
 * 
 * Supports: bold, italic, code (inline), links, code blocks
 */
export function markdownToFeishuRichText(markdown: string): { zh_cn: { title: string; content: RichTextSegment[][] } } {
  const lines = markdown.split('\n');
  const content: RichTextSegment[][] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  
  for (const line of lines) {
    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        const codeText = codeBlockContent.join('\n');
        content.push([{ tag: 'text', text: codeText, style: ['code'] }]);
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }
    
    // Parse inline formatting
    const segments = parseInlineFormatting(line);
    content.push(segments);
  }
  
  return {
    zh_cn: {
      title: '',
      content
    }
  };
}

/**
 * Parse inline markdown formatting
 */
function parseInlineFormatting(line: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  let remaining = line;
  
  // Patterns for inline elements
  const patterns = [
    // Link: [text](url)
    { regex: /\[([^\]]+)\]\(([^)]+)\)/, type: 'link' },
    // Inline code: `code`
    { regex: /`([^`]+)`/, type: 'code' },
    // Bold: **text** or __text__
    { regex: /\*\*([^*]+)\*\*|__([^_]+)__/, type: 'bold' },
    // Italic: *text* or _text_
    { regex: /\*([^*]+)\*|_([^_]+)_/, type: 'italic' },
  ];
  
  while (remaining.length > 0) {
    let earliestMatch: { index: number; match: RegExpMatchArray; type: string } | null = null;
    
    for (const { regex, type } of patterns) {
      const match = remaining.match(regex);
      if (match && (earliestMatch === null || (match.index ?? Infinity) < earliestMatch.index)) {
        earliestMatch = { index: match.index ?? 0, match, type };
      }
    }
    
    if (earliestMatch && earliestMatch.index > 0) {
      // Add text before match
      const beforeText = remaining.slice(0, earliestMatch.index);
      if (beforeText) {
        segments.push({ tag: 'text', text: beforeText });
      }
    }
    
    if (earliestMatch) {
      const { match, type } = earliestMatch;
      const fullMatch = match[0];
      
      if (type === 'link') {
        segments.push({
          tag: 'a',
          text: match[1],
          href: match[2]
        });
      } else if (type === 'code') {
        segments.push({
          tag: 'text',
          text: match[1],
          style: ['code']
        });
      } else if (type === 'bold') {
        const text = match[1] || match[2];
        segments.push({
          tag: 'text',
          text: text,
          style: ['bold']
        });
      } else if (type === 'italic') {
        const text = match[1] || match[2];
        segments.push({
          tag: 'text',
          text: text,
          style: ['italic']
        });
      }
      
      remaining = remaining.slice((match.index ?? 0) + fullMatch.length);
    } else {
      // No more matches, add remaining text
      if (remaining) {
        segments.push({ tag: 'text', text: remaining });
      }
      break;
    }
  }
  
  // If no segments were created, add the line as plain text
  if (segments.length === 0 && line) {
    segments.push({ tag: 'text', text: line });
  }
  
  return segments;
}

/**
 * Check if content has markdown formatting that would benefit from rich text
 */
export function hasMarkdownFormatting(content: string): boolean {
  // Check for common markdown patterns
  const patterns = [
    /\[.+\]\(.+\)/,  // Links
    /`.+`/,          // Inline code
    /\*\*.+\*\*/,    // Bold
    /__.+__/,        // Bold (alt)
    /\*.+\*/,        // Italic
    /_.+_/,          // Italic (alt)
    /^```/m,         // Code block
  ];
  
  return patterns.some(p => p.test(content));
}

/**
 * Main prettify function - filters tags and converts markdown
 * Returns either plain text or rich text content
 */
export function prettifyMessage(content: string): { 
  text: string; 
  richContent?: { zh_cn: { title: string; content: RichTextSegment[][] } };
  useRichText: boolean;
} {
  // Step 1: Filter system tags
  const cleaned = filterSystemTags(content);
  
  // Step 2: Check if markdown conversion is beneficial
  if (hasMarkdownFormatting(cleaned)) {
    const richContent = markdownToFeishuRichText(cleaned);
    return {
      text: cleaned,
      richContent,
      useRichText: true
    };
  }
  
  return {
    text: cleaned,
    useRichText: false
  };
}

export default {
  filterSystemTags,
  markdownToFeishuRichText,
  hasMarkdownFormatting,
  prettifyMessage
};
