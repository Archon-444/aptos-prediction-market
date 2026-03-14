import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronDown, FiCheck } from 'react-icons/fi';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export const Select: React.FC<SelectProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-300 mb-2"
        >
          {label}
        </label>
      )}

      {/* Select Button */}
      <button
        id={id}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-4 py-3 rounded-xl text-left shadow-sm
          bg-[#0D1224]
          border border-[#1C2537]
          text-white
          transition-all duration-200
          flex items-center justify-between
          ${
            isOpen
              ? 'ring-1 ring-primary-500/50 border-primary-500/50'
              : 'hover:border-primary-500/30'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080B18]
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          {selectedOption?.icon && <span className="text-lg">{selectedOption.icon}</span>}
          <span className={selectedOption ? '' : 'text-slate-500'}>
            {selectedOption?.label || placeholder}
          </span>
        </span>
        <FiChevronDown
          className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile */}
            <div
              className="fixed inset-0 z-10 md:hidden"
              onClick={() => setIsOpen(false)}
            />

            <motion.ul
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="
                absolute z-20 w-full mt-2
                bg-[#0D1224]
                border border-[#1C2537]
                rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.5)]
                max-h-60 overflow-auto
                scrollbar-thin
              "
              role="listbox"
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={`
                      px-4 py-3 cursor-pointer
                      flex items-center justify-between gap-2
                      transition-colors duration-150
                      ${
                        isSelected
                          ? 'bg-primary-500/10 text-primary-300'
                          : 'text-slate-200 hover:bg-white/[0.05] hover:text-white'
                      }
                      ${option === options[0] ? 'rounded-t-lg' : ''}
                      ${option === options[options.length - 1] ? 'rounded-b-lg' : ''}
                    `}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="flex items-center gap-2">
                      {option.icon && <span className="text-lg">{option.icon}</span>}
                      <span className="font-medium">{option.label}</span>
                    </span>
                    {isSelected && (
                      <FiCheck className="w-5 h-5 text-primary-400" />
                    )}
                  </li>
                );
              })}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Select;
