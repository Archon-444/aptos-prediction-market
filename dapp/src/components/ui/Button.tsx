import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'error' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
  className?: string;
}

interface ButtonAsButton extends BaseButtonProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  to?: never;
}

interface ButtonAsLink extends BaseButtonProps {
  to: string;
  onClick?: never;
  type?: never;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 focus:ring-primary-500 shadow-sm hover:shadow-md',
  secondary: 'bg-white/[0.06] text-slate-200 border border-white/[0.08] hover:bg-white/[0.1] hover:text-white focus:ring-slate-500',
  success: 'bg-success-500 text-white hover:bg-success-600 active:bg-success-700 focus:ring-success-500',
  error: 'bg-error-500 text-white hover:bg-error-600 active:bg-error-700 focus:ring-error-500',
  ghost: 'bg-transparent text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 active:bg-white/[0.08] focus:ring-slate-500',
  outline: 'bg-transparent border border-primary-500/50 text-primary-400 hover:bg-primary-500/10 hover:border-primary-500 focus:ring-primary-500',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const classes = `
    ${baseClasses}
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  const content = (
    <>
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}

      {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}

      {children}

      {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </>
  );

  // If 'to' prop is provided, render as Link
  if ('to' in props && props.to) {
    return (
      <Link to={props.to} className={classes}>
        {content}
      </Link>
    );
  }

  // Otherwise render as button
  const { disabled, onClick, onAnimationStart, onAnimationEnd, onTransitionEnd, ...restProps } = props as ButtonAsButton;
  return (
    <button
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...restProps}
    >
      {content}
    </button>
  );
};

export default Button;
