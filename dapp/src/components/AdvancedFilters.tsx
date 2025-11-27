import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch,
  FiFilter,
  FiChevronDown,
  FiTrendingUp,
  FiClock,
  FiDollarSign,
  FiX,
} from 'react-icons/fi';
import { Input } from './ui/Input';

export enum SortOption {
  NEWEST = 'newest',
  ENDING_SOON = 'ending_soon',
  HIGHEST_VOLUME = 'highest_volume',
  MOST_POPULAR = 'most_popular',
}

export enum StatusFilter {
  ALL = 'all',
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  ENDING_SOON = 'ending_soon',
}

interface AdvancedFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  totalResults?: number;
}

const SORT_OPTIONS = [
  { value: SortOption.NEWEST, label: 'Newest First', icon: FiClock },
  { value: SortOption.ENDING_SOON, label: 'Ending Soon', icon: FiClock },
  { value: SortOption.HIGHEST_VOLUME, label: 'Highest Volume', icon: FiDollarSign },
  { value: SortOption.MOST_POPULAR, label: 'Most Popular', icon: FiTrendingUp },
];

const STATUS_OPTIONS = [
  { value: StatusFilter.ALL, label: 'All Markets' },
  { value: StatusFilter.ACTIVE, label: 'Active' },
  { value: StatusFilter.RESOLVED, label: 'Resolved' },
  { value: StatusFilter.ENDING_SOON, label: 'Ending Soon' },
];

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  statusFilter,
  onStatusChange,
  totalResults = 0,
}) => {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const selectedSort = SORT_OPTIONS.find((opt) => opt.value === sortBy);
  const selectedStatus = STATUS_OPTIONS.find((opt) => opt.value === statusFilter);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<FiSearch className="w-5 h-5 text-gray-400" />}
          rightIcon={
            searchQuery ? (
              <button
                onClick={() => onSearchChange('')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Clear search"
              >
                <FiX className="w-5 h-5" />
              </button>
            ) : undefined
          }
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200/80 dark:border-gray-800/80 bg-gray-50/80 dark:bg-gray-900/40 px-4 py-3">
        {/* Status Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowStatusMenu(!showStatusMenu);
              setShowSortMenu(false);
            }}
            className="flex items-center gap-2 rounded-full border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:border-primary-300 hover:text-primary-600 dark:hover:text-primary-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:focus-visible:ring-offset-gray-900"
            aria-label="Filter by status"
            aria-expanded={showStatusMenu}
          >
            <FiFilter className="w-4 h-4" />
            <span>{selectedStatus?.label}</span>
            <FiChevronDown
              className={`w-4 h-4 transition-transform ${
                showStatusMenu ? 'rotate-180' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {showStatusMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowStatusMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full mt-2 left-0 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onStatusChange(option.value);
                        setShowStatusMenu(false);
                      }}
                      className={`
                        w-full px-4 py-2.5 text-left text-sm transition-colors
                        ${
                          statusFilter === option.value
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }
                      `}
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowSortMenu(!showSortMenu);
              setShowStatusMenu(false);
            }}
            className="flex items-center gap-2 rounded-full border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:border-primary-300 hover:text-primary-600 dark:hover:text-primary-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:focus-visible:ring-offset-gray-900"
            aria-label="Sort markets"
            aria-expanded={showSortMenu}
          >
            {selectedSort && <selectedSort.icon className="w-4 h-4" />}
            <span>{selectedSort?.label}</span>
            <FiChevronDown
              className={`w-4 h-4 transition-transform ${showSortMenu ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {showSortMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSortMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full mt-2 left-0 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden"
                >
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onSortChange(option.value);
                        setShowSortMenu(false);
                      }}
                      className={`
                        w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2
                        ${
                          sortBy === option.value
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }
                      `}
                    >
                      <option.icon className="w-4 h-4" />
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Results Count */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="hidden text-sm text-gray-600 dark:text-gray-400 sm:inline">
            {totalResults} {totalResults === 1 ? 'market' : 'markets'}
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {(searchQuery || statusFilter !== StatusFilter.ALL) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 px-3 py-2">
          <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Active filters:</span>
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-md text-xs font-medium">
              Search: "{searchQuery}"
              <button
                onClick={() => onSearchChange('')}
                className="hover:text-primary-700 dark:hover:text-primary-300"
                aria-label="Remove search filter"
              >
                <FiX className="w-3 h-3" />
              </button>
            </span>
          )}
          {statusFilter !== StatusFilter.ALL && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-md text-xs font-medium">
              Status: {selectedStatus?.label}
              <button
                onClick={() => onStatusChange(StatusFilter.ALL)}
                className="hover:text-primary-700 dark:hover:text-primary-300"
                aria-label="Remove status filter"
              >
                <FiX className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              onSearchChange('');
              onStatusChange(StatusFilter.ALL);
            }}
            className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilters;
