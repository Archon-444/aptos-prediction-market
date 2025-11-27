import React from 'react';

export type TikiButtonVariant = 'primary' | 'secondary' | 'success' | 'danger';
export type TikiButtonSize = 'sm' | 'md' | 'lg';

export interface TikiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Button style variant
   */
  variant?: TikiButtonVariant;

  /**
   * Button size
   */
  size?: TikiButtonSize;

  /**
   * Show loading state with spinning MaskBro
   */
  loading?: boolean;

  /**
   * Emoji to display before text
   */
  emoji?: string;

  /**
   * Make button full width
   */
  fullWidth?: boolean;
}

const variantStyles: Record<TikiButtonVariant, string> = {
  primary: `
    bg-gradient-to-r from-tiki-coral to-tiki-mango
    hover:from-tiki-mango hover:to-tiki-coral
    text-white shadow-glow-coral
    hover:shadow-glow-mango
  `,
  secondary: `
    bg-gradient-to-r from-tiki-turquoise to-tiki-lagoon
    hover:from-tiki-lagoon hover:to-tiki-turquoise
    text-white shadow-glow
  `,
  success: `
    bg-gradient-to-r from-tiki-bamboo to-tiki-lagoon
    hover:from-tiki-lagoon hover:to-tiki-bamboo
    text-white
  `,
  danger: `
    bg-gradient-to-r from-tiki-volcano to-tiki-sunset
    hover:from-tiki-sunset hover:to-tiki-volcano
    text-white
  `,
};

const sizeStyles: Record<TikiButtonSize, string> = {
  sm: 'px-4 py-2 text-sm rounded-full',
  md: 'px-6 py-3 text-base rounded-full',
  lg: 'px-8 py-4 text-lg rounded-full',
};

/**
 * TikiButton Component
 *
 * Tiki-themed button with gradient backgrounds, rounded pill shape,
 * and playful hover effects.
 *
 * @example
 * ```tsx
 * <TikiButton
 *   variant="primary"
 *   emoji="🌺"
 *   onClick={handleClick}
 * >
 *   Place Bet
 * </TikiButton>
 * ```
 */
export const TikiButton: React.FC<TikiButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  emoji,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}) => {
  // Create accessible label for buttons with only emoji
  const hasTextContent = children && String(children).trim().length > 0;
  const ariaLabel = !hasTextContent && emoji ? `Button with ${emoji} icon` : props['aria-label'];

  return (
    <button
      className={`
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        font-baloo font-bold
        will-change-transform
        transform transition-all duration-200
        hover:scale-105 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading}
      {...props}
    >
      <span className="flex items-center justify-center gap-2">
        {loading ? (
          <>
            <span className="text-xl animate-spin-slow" aria-hidden="true">🗿</span>
            <span className="sr-only">Loading...</span>
          </>
        ) : emoji ? (
          <span className="text-xl" aria-hidden="true">{emoji}</span>
        ) : null}
        {children}
      </span>
    </button>
  );
};

export default TikiButton;
