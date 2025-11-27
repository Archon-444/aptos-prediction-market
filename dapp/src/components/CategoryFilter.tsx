import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { MarketCategory, CATEGORY_INFO } from '../types/categories';

interface CategoryFilterProps {
  selectedCategory: MarketCategory;
  onCategoryChange: (category: MarketCategory) => void;
  marketCounts?: Record<MarketCategory, number>;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onCategoryChange,
  marketCounts = {},
}) => {
  const categories = Object.values(MarketCategory);

  return (
    <div className="w-full overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex gap-3 min-w-max md:flex-wrap md:min-w-0">
        {categories.map((category) => {
          const info = CATEGORY_INFO[category];
          const isSelected = selectedCategory === category;
          const count = marketCounts[category] || 0;

          return (
            <motion.div key={category} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button
                onClick={() => onCategoryChange(category)}
                className={clsx(
                  'relative flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:focus-visible:ring-offset-gray-900',
                  isSelected
                    ? [
                        info.bgColor,
                        info.color,
                        'shadow-md shadow-primary-500/10 border border-transparent',
                      ]
                    : [
                        'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary-400/60 hover:text-primary-600 dark:hover:text-primary-300',
                      ]
                )}
                aria-label={`Filter by ${info.label}`}
                aria-pressed={isSelected}
              >
                <span className="text-lg" role="img" aria-label={info.label}>
                  {info.icon}
                </span>
                <span className="whitespace-nowrap">{info.label}</span>
                {count > 0 && (
                  <span
                    className={clsx(
                      'ml-1 rounded-full px-2 py-0.5 text-xs font-bold',
                      isSelected
                        ? 'bg-white/20 dark:bg-black/10'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryFilter;
