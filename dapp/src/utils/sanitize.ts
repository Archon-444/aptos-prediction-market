/**
 * XSS Protection & Input Sanitization
 *
 * Uses DOMPurify to sanitize all user-generated content and prevent XSS attacks.
 * This is CRITICAL for security as we display user input (market questions, descriptions, etc.)
 *
 * OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content with strict rules
 * Use for content that may contain basic formatting (bold, italic, links)
 */
export const sanitizeHTML = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
};

/**
 * Sanitize plain text - removes ALL HTML tags
 * Use for market questions, titles, short descriptions
 */
export const sanitizeText = (text: string): string => {
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  });
};

/**
 * Sanitize rich text content
 * Use for longer descriptions that may need formatting
 */
export const sanitizeRichText = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
};

/**
 * Sanitize URL to prevent javascript: and data: URIs
 */
export const sanitizeURL = (url: string): string => {
  const sanitized = DOMPurify.sanitize(url, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  // Additional check for dangerous protocols
  if (
    sanitized.toLowerCase().startsWith('javascript:') ||
    sanitized.toLowerCase().startsWith('data:') ||
    sanitized.toLowerCase().startsWith('vbscript:')
  ) {
    return '';
  }

  return sanitized;
};

/**
 * Escape HTML special characters
 * Use when you need to display user input as-is without any HTML interpretation
 */
export const escapeHTML = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Sanitize market question
 * Removes all HTML and limits length
 */
export const sanitizeMarketQuestion = (question: string, maxLength: number = 200): string => {
  let sanitized = sanitizeText(question);

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }

  return sanitized;
};

/**
 * Sanitize market description
 * Allows basic formatting but limits length
 */
export const sanitizeMarketDescription = (description: string, maxLength: number = 1000): string => {
  let sanitized = sanitizeRichText(description);

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }

  return sanitized;
};

/**
 * Sanitize user display name
 * Removes all HTML and special characters
 */
export const sanitizeDisplayName = (name: string, maxLength: number = 50): string => {
  let sanitized = sanitizeText(name);

  // Remove special characters except alphanumeric, space, dash, underscore
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
};

/**
 * Sanitize search query
 * Removes potentially dangerous characters
 */
export const sanitizeSearchQuery = (query: string, maxLength: number = 100): string => {
  let sanitized = sanitizeText(query);

  // Remove special SQL/NoSQL characters
  sanitized = sanitized.replace(/[;<>{}()[\]]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
};

/**
 * Validate and sanitize Aptos address
 * Ensures only valid hex characters
 */
export const sanitizeAptosAddress = (address: string): string => {
  // Remove 0x prefix if present
  let sanitized = address.startsWith('0x') ? address.slice(2) : address;

  // Keep only valid hex characters
  sanitized = sanitized.replace(/[^0-9a-fA-F]/g, '');

  // Limit to 64 characters (max Aptos address length)
  if (sanitized.length > 64) {
    sanitized = sanitized.substring(0, 64);
  }

  // Add 0x prefix back
  return sanitized ? '0x' + sanitized : '';
};

/**
 * Configure DOMPurify hooks for additional security
 */
export const configureDOMPurify = (): void => {
  // Add a hook to enforce target="_blank" and rel="noopener noreferrer" on all links
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });

  // Remove any attributes starting with "on" to prevent inline event handlers
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName.startsWith('on')) {
      data.keepAttr = false;
    }
  });
};

// Configure DOMPurify on module load
if (typeof window !== 'undefined') {
  configureDOMPurify();
}

/**
 * Type-safe sanitization wrapper
 * Ensures all user input goes through sanitization
 */
export interface SanitizedContent {
  raw: string;
  sanitized: string;
  type: 'text' | 'html' | 'richtext' | 'url';
}

export const createSanitizedContent = (
  raw: string,
  type: 'text' | 'html' | 'richtext' | 'url' = 'text'
): SanitizedContent => {
  let sanitized: string;

  switch (type) {
    case 'html':
      sanitized = sanitizeHTML(raw);
      break;
    case 'richtext':
      sanitized = sanitizeRichText(raw);
      break;
    case 'url':
      sanitized = sanitizeURL(raw);
      break;
    case 'text':
    default:
      sanitized = sanitizeText(raw);
      break;
  }

  return {
    raw,
    sanitized,
    type,
  };
};
