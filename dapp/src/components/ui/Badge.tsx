import React from 'react';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  title?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  primary: 'bg-primary-500/15 text-primary-300 border-primary-500/20',
  secondary: 'bg-secondary-500/15 text-secondary-300 border-secondary-500/20',
  success: 'bg-success-500/15 text-success-300 border-success-500/20',
  warning: 'bg-warning-500/15 text-warning-300 border-warning-500/20',
  error: 'bg-error-500/15 text-error-300 border-error-500/20',
  info: 'bg-primary-500/15 text-primary-300 border-primary-500/20',
  neutral: 'bg-white/[0.06] text-slate-400 border-white/[0.08]',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-sm',
  lg: 'px-3 py-1 text-base',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  children,
  icon,
  className = '',
  title,
}) => {
  const classes = `
    inline-flex items-center gap-1 rounded-full font-medium border
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <span className={classes} title={title}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

export default Badge;
