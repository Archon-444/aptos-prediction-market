import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = true,
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded-lg';
      case 'text':
      default:
        return 'rounded';
    }
  };

  const style: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'text' ? '1em' : undefined),
  };

  const baseClass = `bg-white/[0.08] ${getVariantClass()} ${className}`;

  if (animation) {
    return (
      <motion.div
        className={baseClass}
        style={style}
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    );
  }

  return <div className={baseClass} style={style} />;
};

// Market Card Skeleton
export const MarketCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton width={80} height={24} className="rounded-full" />
        <Skeleton width={60} height={20} className="rounded-full" />
      </div>
      <Skeleton width="100%" height={56} className="mb-4" />
      <div className="space-y-3 mb-4">
        <div>
          <Skeleton width="40%" height={16} className="mb-1" />
          <Skeleton width="100%" height={8} />
        </div>
        <div>
          <Skeleton width="40%" height={16} className="mb-1" />
          <Skeleton width="100%" height={8} />
        </div>
      </div>
      <div className="pt-4 border-t border-gray-100 space-y-2">
        <div className="flex justify-between">
          <Skeleton width={60} height={14} />
          <Skeleton width={80} height={14} />
        </div>
        <div className="flex justify-between">
          <Skeleton width={60} height={14} />
          <Skeleton width={80} height={14} />
        </div>
      </div>
      <Skeleton width="100%" height={40} className="mt-4 rounded-lg" />
    </div>
  );
};

// Stats Card Skeleton
export const StatsCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-4">
      <Skeleton width="60%" height={14} className="mb-2" />
      <Skeleton width="80%" height={32} />
    </div>
  );
};

// User Bet Skeleton
export const UserBetSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton variant="circular" width={20} height={20} />
        <div className="flex-1">
          <Skeleton width="100%" height={48} className="mb-2" />
          <div className="flex gap-2">
            <Skeleton width={60} height={24} className="rounded-full" />
            <Skeleton width={60} height={24} className="rounded-full" />
            <Skeleton width={80} height={24} className="rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex gap-4">
        <Skeleton width={120} height={14} />
        <Skeleton width={120} height={14} />
      </div>
    </div>
  );
};

// Table Row Skeleton
export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 4 }) => {
  return (
    <div className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-lg">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} width="100%" height={20} />
      ))}
    </div>
  );
};

export default Skeleton;
