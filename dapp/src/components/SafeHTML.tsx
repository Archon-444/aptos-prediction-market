import React from 'react';
import { sanitizeHTML, sanitizeText, sanitizeRichText } from '../utils/sanitize';

interface SafeHTMLProps {
  html: string;
  type?: 'text' | 'html' | 'richtext';
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * SafeHTML Component
 *
 * Safely renders user-generated HTML content by sanitizing it through DOMPurify.
 * ALWAYS use this component instead of dangerouslySetInnerHTML.
 *
 * @example
 * // Render plain text (default)
 * <SafeHTML html={userInput} />
 *
 * // Render basic HTML
 * <SafeHTML html={userDescription} type="html" />
 *
 * // Render rich text with formatting
 * <SafeHTML html={marketDescription} type="richtext" as="div" className="prose" />
 */
export const SafeHTML: React.FC<SafeHTMLProps> = ({
  html,
  type = 'text',
  className = '',
  as: Component = 'div',
}) => {
  const sanitize = (content: string): string => {
    switch (type) {
      case 'html':
        return sanitizeHTML(content);
      case 'richtext':
        return sanitizeRichText(content);
      case 'text':
      default:
        return sanitizeText(content);
    }
  };

  const sanitized = sanitize(html);

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

export default SafeHTML;
