import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBell,
  FiCheck,
  FiX,
  FiClock,
  FiArrowRight,
} from 'react-icons/fi';
import type { AppNotification, NotificationKind } from '../../hooks/useNotifications';
import { sanitizeMarketQuestion } from '../../utils/sanitize';

const KIND_CONFIG: Record<
  NotificationKind,
  { icon: React.ElementType; iconBg: string; iconColor: string; label: string }
> = {
  win_claimable: {
    icon: FiCheck,
    iconBg: 'bg-success-500/20',
    iconColor: 'text-success-400',
    label: 'You won!',
  },
  market_resolved_loss: {
    icon: FiX,
    iconBg: 'bg-error-500/10',
    iconColor: 'text-error-400',
    label: 'Market resolved',
  },
  ending_soon: {
    icon: FiClock,
    iconBg: 'bg-warning-500/10',
    iconColor: 'text-warning-400',
    label: 'Ending soon',
  },
};

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onMouse = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouse);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouse);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-full mt-2 w-96 max-h-[min(480px,80vh)] flex flex-col bg-[#0D1224] rounded-2xl border border-[#1C2537] shadow-[0_24px_64px_rgba(0,0,0,0.7)] overflow-hidden z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                  <FiBell className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-sm font-semibold text-slate-400 mb-1">You're all caught up</p>
                <p className="text-xs text-slate-600">
                  Notifications about your bets will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {notifications.map((notification) => {
                  const cfg = KIND_CONFIG[notification.kind];
                  const Icon = cfg.icon;

                  return (
                    <li
                      key={notification.id}
                      className={!notification.read ? 'bg-primary-500/[0.03]' : ''}
                    >
                      <Link
                        to={`/market/${notification.marketId}`}
                        onClick={() => {
                          onMarkRead(notification.id);
                          onClose();
                        }}
                        className="flex items-start gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors group"
                      >
                        {/* Icon with unread dot */}
                        <div className="flex-shrink-0 mt-0.5 relative">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.iconBg}`}
                          >
                            <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
                          </div>
                          {!notification.read && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary-500 rounded-full border-2 border-[#0D1224]" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${cfg.iconColor}`}
                            >
                              {cfg.label}
                            </span>
                            {notification.kind === 'win_claimable' && notification.amount != null && (
                              <span className="text-xs font-bold text-success-400">
                                +${(notification.amount / 1_000_000).toFixed(2)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-slate-300 line-clamp-2 leading-snug">
                            {sanitizeMarketQuestion(notification.question)}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Bet on:{' '}
                            <span className="text-slate-400">{notification.outcomeLabel}</span>
                          </p>
                        </div>

                        <FiArrowRight className="flex-shrink-0 w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors mt-1" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-white/[0.06] px-5 py-3 flex-shrink-0">
              <Link
                to="/dashboard"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-white transition-colors"
              >
                View all positions
                <FiArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationPanel;
