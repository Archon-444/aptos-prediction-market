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
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
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
          bg-gray-50/80 dark:bg-gray-900/60
          border border-gray-200/80 dark:border-gray-700/70
          text-gray-900 dark:text-white
          transition-all duration-200 backdrop-blur
          flex items-center justify-between
          ${
            isOpen
              ? 'ring-2 ring-primary-400/70 border-primary-400/70 dark:border-primary-500'
              : 'hover:border-primary-300/70 dark:hover:border-primary-400/60'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:focus-visible:ring-offset-gray-900
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          {selectedOption?.icon && <span className="text-lg">{selectedOption.icon}</span>}
          <span className={selectedOption ? '' : 'text-gray-500 dark:text-gray-400'}>
            {selectedOption?.label || placeholder}
          </span>
        </span>
        <FiChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
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
                bg-white/95 dark:bg-gray-900/95
                border border-gray-200/80 dark:border-gray-700/70
                rounded-2xl shadow-lg shadow-black/10 backdrop-blur
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
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300'
                          : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100/70 dark:hover:bg-gray-800/50'
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
                      <FiCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
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
