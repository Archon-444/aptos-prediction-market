import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  fullWidth = true,
  className = '',
  ...props
}) => {
  const inputClasses = `
    block rounded-xl border bg-[#0D1224] text-slate-100 placeholder-slate-500 shadow-sm transition-all duration-150
    ${error ? 'border-error-500 focus:border-error-500 focus:ring-error-500' : 'border-[#1C2537] focus:border-primary-500 focus:ring-primary-500'}
    ${leftIcon ? 'pl-10' : 'px-4'}
    ${rightIcon ? 'pr-10' : 'px-4'}
    py-2.5
    ${fullWidth ? 'w-full' : ''}
    disabled:opacity-50 disabled:cursor-not-allowed
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-slate-500">{leftIcon}</span>
          </div>
        )}

        <input
          className={inputClasses}
          {...props}
        />

        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-slate-500">{rightIcon}</span>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-error-400">{error}</p>
      )}

      {helperText && !error && (
        <p className="mt-2 text-sm text-slate-500">{helperText}</p>
      )}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helperText,
  fullWidth = true,
  className = '',
  ...props
}) => {
  const textareaClasses = `
    block rounded-xl border bg-[#0D1224] text-slate-100 placeholder-slate-500 shadow-sm transition-all duration-150
    ${error ? 'border-error-500 focus:border-error-500 focus:ring-error-500' : 'border-[#1C2537] focus:border-primary-500 focus:ring-primary-500'}
    px-4 py-2.5
    ${fullWidth ? 'w-full' : ''}
    disabled:opacity-50 disabled:cursor-not-allowed
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {label}
        </label>
      )}

      <textarea
        className={textareaClasses}
        {...props}
      />

      {error && (
        <p className="mt-2 text-sm text-error-500">{error}</p>
      )}

      {helperText && !error && (
        <p className="mt-2 text-sm text-slate-500">{helperText}</p>
      )}
    </div>
  );
};

export default Input;
