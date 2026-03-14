import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiHome,
  FiTrendingUp,
  FiPieChart,
  FiUser,
  FiPlusCircle,
} from 'react-icons/fi';
import { hapticFeedback } from '../../utils/hapticFeedback';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: FiHome,
  },
  {
    label: 'Markets',
    href: '/markets',
    icon: FiTrendingUp,
  },
  {
    label: 'Create',
    href: '/create',
    icon: FiPlusCircle,
  },
  {
    label: 'Stats',
    href: '/dashboard',
    icon: FiPieChart,
  },
  {
    label: 'Profile',
    href: '/profile',
    icon: FiUser,
  },
];

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#080B18]/95 backdrop-blur-xl border-t border-white/[0.05] safe-bottom">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => hapticFeedback.navigation()}
              className="relative flex flex-col items-center justify-center space-y-1 touch-manipulation"
            >
              {/* Active Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary-500 rounded-b-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}

              {/* Icon */}
              <div
                className={`relative ${
                  isActive
                    ? 'text-primary-500'
                    : 'text-slate-500'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''} transition-transform`} />

                {/* Special highlight for Create button */}
                {item.href === '/create' && (
                  <div className="absolute -inset-2 bg-primary-500/10 rounded-full -z-10" />
                )}
              </div>

              {/* Label */}
              <span
                className={`text-xs font-medium ${
                  isActive
                    ? 'text-primary-500'
                    : 'text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Safe area for iPhone notch */}
      <div className="h-safe-bottom bg-[#080B18]" />
    </nav>
  );
};

export default MobileBottomNav;
