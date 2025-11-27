import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiArrowUpRight } from 'react-icons/fi';
import { useLeaderboard } from '../hooks/useLeaderboard';
import type { LeaderboardMetric, LeaderboardPeriod } from '../services/api/types';
import { useUnifiedWallet } from '../hooks/useUnifiedWallet';

const METRIC_OPTIONS: { id: LeaderboardMetric; label: string; icon: string }[] = [
  { id: 'profit', label: 'Profit', icon: '💰' },
  { id: 'volume', label: 'Volume', icon: '📊' },
];

const PERIOD_OPTIONS: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'daily', label: '24h' },
  { id: 'weekly', label: '7d' },
  { id: 'monthly', label: '30d' },
  { id: 'all_time', label: 'All Time' },
];

const CHAIN_OPTIONS = [
  { id: 'all', label: 'All Chains' },
  { id: 'aptos', label: 'Aptos' },
  { id: 'sui', label: 'Sui' },
];

const CHAIN_BADGE_CLASSES: Record<'aptos' | 'sui' | 'movement', string> = {
  aptos: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200',
  sui: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-200',
  movement: 'bg-gray-200 text-gray-700 dark:bg-gray-700/40 dark:text-gray-200',
};

const CHAIN_LABELS: Record<'aptos' | 'sui' | 'movement', string> = {
  aptos: 'Aptos',
  sui: 'Sui',
  movement: 'Movement',
};

const formatValue = (metric: LeaderboardMetric, entry: { value: string; totalProfit: string; totalVolume: string }) => {
  if (metric === 'profit') {
    return formatCurrency(Number(entry.totalProfit ?? entry.value));
  }
  return formatCurrency(Number(entry.totalVolume ?? entry.value));
};

const LeaderboardPage = () => {
  const [metric, setMetric] = useState<LeaderboardMetric>('profit');
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [chain, setChain] = useState<'aptos' | 'sui' | 'movement' | 'all'>('all');
  const { leaders, isLoading, error } = useLeaderboard({ metric, period, chain });
  const { address } = useUnifiedWallet();

  const podium = useMemo(() => leaders.slice(0, 3), [leaders]);
  const rest = useMemo(() => leaders.slice(3), [leaders]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="container mx-auto px-4 py-10 space-y-8"
    >
      <header className="space-y-3">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900 dark:text-white">
          Leaderboards
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Track the top performers across profit and volume leaderboards. Place smart bets to climb the rankings.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1">
          {METRIC_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setMetric(option.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                metric === option.id
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:text-primary-500'
              }`}
            >
              <span className="mr-1">{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setPeriod(option.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                period === option.id
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'text-gray-600 dark:text-gray-300 hover:text-primary-500'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1">
          {CHAIN_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setChain(option.id as typeof chain)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                chain === option.id
                  ? 'bg-secondary-500 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:text-secondary-500'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Top {metric === 'profit' ? 'Profit' : 'Volume'} Leaders · {period.replace('_', ' ').toUpperCase()}
          </h2>
          {address && (
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <FiArrowUpRight className="text-primary-500" />
              Connect more markets to climb the leaderboard
            </div>
          )}
        </div>

        {isLoading && (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            Loading leaderboard...
          </div>
        )}

        {error && (
          <div className="px-6 py-12 text-center text-red-500">
            Failed to load leaderboard: {error.message}
          </div>
        )}

        {!isLoading && !error && (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 py-8">
              {podium.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-4 text-center"
                >
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    #{entry.rank}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                    {entry.displayName ?? entry.walletAddress.slice(0, 6) + '...' + entry.walletAddress.slice(-4)}
                  </div>
                  <div className="mt-3 text-2xl font-bold text-primary-500">
                    {formatValue(metric, entry)}
                  </div>
                  <div className="mt-3">
                    {renderChainBadge(entry.chain as 'aptos' | 'sui' | 'movement')}
                  </div>
                </div>
              ))}
              {podium.length === 0 && (
                <div className="col-span-3 text-center text-gray-500 dark:text-gray-400">
                  No leaderboard entries yet. Place the first bet to claim the top spot!
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Trader
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {metric === 'profit' ? 'Total Profit' : 'Total Volume'}
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Win Rate
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Bets
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Chain
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {rest.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">#{entry.rank}</td>
                      <td className="px-6 py-3 text-sm text-gray-900 dark:text-white font-medium">
                        {entry.displayName ?? entry.walletAddress.slice(0, 6) + '...' + entry.walletAddress.slice(-4)}
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-primary-500">
                        {formatValue(metric, entry)}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {entry.winRate.toFixed(1)}%
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {entry.totalBets}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        {renderChainBadge(entry.chain as 'aptos' | 'sui' | 'movement')}
                      </td>
                  </tr>
                ))}
                  {rest.length === 0 && podium.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                      >
                        Leaderboard is empty. Participate in markets to get ranked.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </motion.div>
  );
};

export default LeaderboardPage;
const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) => formatter.format(value);

const renderChainBadge = (chain: 'aptos' | 'sui' | 'movement') => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${CHAIN_BADGE_CLASSES[chain]}`}
  >
    {CHAIN_LABELS[chain]}
  </span>
);
