import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiClock,
  FiTrendingUp,
  FiDollarSign,
  FiArrowLeft,
  FiShare2,
  FiCheck,
  FiLayers,
} from 'react-icons/fi';
import { format } from 'date-fns';
import { Container } from '../components/layout/Container';
import { Button } from '../components/ui/Button';
import { useCountdown } from '../hooks/useCountdown';
import { useMarket } from '../hooks/useMarkets';
import MarketResolutionPanel from '../components/MarketResolutionPanel';
import { fromMicroUSDC, VALIDATION_CONSTANTS } from '../utils/validation';
import { sanitizeMarketQuestion } from '../utils/sanitize';
import BettingModal from '../components/BettingModal';
import { usePlaceBet } from '../hooks/useTransactions';
import { getCategoryFromQuestion, getCategoryInfo } from '../types/categories';

const formatNumber = (v: number, d = 2): string =>
  v.toLocaleString('en-US', { maximumFractionDigits: d });

const formatAddress = (addr: string): string =>
  addr.length <= 10 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const formatVolume = (micro: number): string => {
  const v = fromMicroUSDC(micro);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
};

const getTimeLabel = (isExpired: boolean, countdown: ReturnType<typeof useCountdown>): string => {
  if (isExpired) return 'Market Closed';
  const { days, hours, minutes, seconds } = countdown;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m ${seconds}s left`;
};

export const MarketDetailPage: React.FC = () => {
  const { id } = useParams();
  const marketId = useMemo(() => {
    if (!id) return null;
    const n = Number(id);
    return Number.isNaN(n) ? null : n;
  }, [id]);

  const { market, isLoading, error } = useMarket(marketId);
  const { placeBet, isLoading: isPlacingBet } = usePlaceBet();
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState<number | null>(null);
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const countdown = useCountdown(market ? market.endTime * 1000 : Date.now());
  const totalStakes = market ? fromMicroUSDC(market.totalStakes) : 0;

  const question = market ? sanitizeMarketQuestion(market.question) : '';
  const category = market ? getCategoryFromQuestion(market.question) : null;
  const categoryInfo = category ? getCategoryInfo(category) : null;

  const outcomeData = useMemo(() => {
    if (!market) return [];
    const total = market.totalStakes;
    return market.outcomes.map((label, index) => {
      const stake = fromMicroUSDC(market.outcomeStakes[index] ?? 0);
      const pct = total > 0 ? Math.round(((market.outcomeStakes[index] ?? 0) / total) * 100) : 0;
      return { label, stake, pct };
    });
  }, [market]);

  const selectedOutcome = useMemo(() => {
    if (selectedOutcomeIndex === null || !market) return null;
    const { label, pct, stake } = outcomeData[selectedOutcomeIndex];
    return {
      label,
      odds: pct,
      pool: `$${formatNumber(stake)}`,
    };
  }, [selectedOutcomeIndex, market, outcomeData]);

  const isBinary = market?.outcomes.length === 2;

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080B18]">
        <Container className="py-10">
          <div className="space-y-4">
            <div className="skeleton h-8 w-32 rounded-xl" />
            <div className="skeleton h-48 w-full rounded-2xl" />
            <div className="skeleton h-40 w-full rounded-2xl" />
          </div>
        </Container>
      </div>
    );
  }

  // Error
  if (error || (!isLoading && !market)) {
    return (
      <div className="min-h-screen bg-[#080B18]">
        <Container className="py-10">
          <div className="rounded-2xl border border-error-500/30 bg-error-500/[0.06] p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-2">
              {error ? 'Failed to load market' : 'Market not found'}
            </h2>
            <p className="text-slate-400 mb-6 text-sm">
              {error?.message ?? 'This market may have been removed or the identifier is incorrect.'}
            </p>
            <Button variant="ghost" to="/markets" leftIcon={<FiArrowLeft />} className="border border-white/10 text-slate-300">
              Back to Markets
            </Button>
          </div>
        </Container>
      </div>
    );
  }

  const isExpired = countdown.isExpired || market!.resolved;
  const timeLabel = getTimeLabel(countdown.isExpired, countdown);
  const statusIsActive = !market!.resolved && !countdown.isExpired;

  return (
    <div className="min-h-screen bg-[#080B18] text-white selection:bg-primary-500/30">
      <Container className="py-8 md:py-12">
        {/* ── Breadcrumb ─────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/markets"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"
          >
            <FiArrowLeft className="w-4 h-4" />
            All Markets
          </Link>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"
          >
            {copied ? (
              <>
                <FiCheck className="w-4 h-4 text-success-400" />
                <span className="text-success-400">Copied!</span>
              </>
            ) : (
              <>
                <FiShare2 className="w-4 h-4" />
                Share
              </>
            )}
          </button>
        </div>

        {/* ── Admin resolution panel ──────────────────────── */}
        <MarketResolutionPanel marketId={marketId} />

        <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-4">
          {/* ── Left column ──────────────────────────────── */}
          <div className="space-y-5">
            {/* Market header card */}
            <div
              className="rounded-2xl border border-[#1C2537] bg-[#0D1224] p-6"
              style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}
            >
              {/* Tags row */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-white/[0.05] px-3 py-1 rounded-full border border-white/[0.07]">
                  Market #{market!.id}
                </span>
                {categoryInfo && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-white/[0.05] px-3 py-1 rounded-full border border-white/[0.07]">
                    <span>{categoryInfo.icon}</span>
                    {categoryInfo.label}
                  </span>
                )}
                {/* Status */}
                <div className="inline-flex items-center gap-1.5 ml-auto">
                  <span className="relative flex h-2 w-2">
                    {statusIsActive && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-400 opacity-75" />
                    )}
                    <span className={`relative inline-flex h-2 w-2 rounded-full ${
                      market!.resolved ? 'bg-slate-500' :
                      countdown.isExpired ? 'bg-warning-400' : 'bg-success-400'
                    }`} />
                  </span>
                  <span className={`text-sm font-semibold ${
                    market!.resolved ? 'text-slate-400' :
                    countdown.isExpired ? 'text-warning-400' : 'text-success-400'
                  }`}>
                    {market!.resolved ? 'Resolved' : countdown.isExpired ? 'Pending Resolution' : 'Live'}
                  </span>
                </div>
              </div>

              {/* Question */}
              <h1 className="text-2xl md:text-3xl font-black text-white leading-snug tracking-tight mb-4">
                {question}
              </h1>

              {/* Creator + time */}
              <p className="text-sm text-slate-500 mb-6">
                Created by{' '}
                <span className="font-mono text-slate-400">{formatAddress(market!.creator)}</span>
                {' · '}
                {format(market!.createdAt * 1000, 'MMM d, yyyy')}
              </p>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: FiDollarSign, iconColor: 'text-primary-400', bg: 'bg-primary-500/10', label: 'Total Volume', value: formatVolume(market!.totalStakes) },
                  { icon: FiLayers, iconColor: 'text-secondary-400', bg: 'bg-secondary-500/10', label: 'Outcomes', value: market!.outcomes.length.toString() },
                  { icon: FiClock, iconColor: 'text-warning-400', bg: 'bg-warning-500/10', label: market!.resolved ? 'Ended' : 'Time Left', value: market!.resolved ? format(market!.endTime * 1000, 'MMM d') : timeLabel },
                  { icon: FiTrendingUp, iconColor: 'text-success-400', bg: 'bg-success-500/10', label: 'Status', value: market!.resolved ? `Winner: ${market!.outcomes[market!.winningOutcome] ?? '?'}` : statusIsActive ? 'Active' : 'Pending' },
                ].map(({ icon: Icon, iconColor, bg, label, value }) => (
                  <div key={label} className="flex items-start gap-3 rounded-xl bg-white/[0.025] border border-white/[0.05] p-3">
                    <div className={`flex-shrink-0 p-2 rounded-lg ${bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-500 font-medium mb-0.5">{label}</div>
                      <div className="text-sm font-bold text-white truncate">{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Outcomes card */}
            <div
              className="rounded-2xl border border-[#1C2537] bg-[#0D1224] p-6"
              style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}
            >
              <h2 className="text-lg font-bold text-white mb-1">Outcomes</h2>
              <p className="text-sm text-slate-500 mb-5">
                {market!.resolved
                  ? 'This market has been resolved.'
                  : 'Select an outcome to place your prediction.'}
              </p>

              <div className="space-y-3">
                {outcomeData.map((outcome, index) => {
                  const isSelected = selectedOutcomeIndex === index;
                  const isWinner = market!.resolved && market!.winningOutcome === index;
                  const isLoser = market!.resolved && market!.winningOutcome !== index;

                  return (
                    <motion.button
                      key={`${outcome.label}-${index}`}
                      type="button"
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        if (!isExpired) setSelectedOutcomeIndex(index);
                      }}
                      disabled={isExpired}
                      className={[
                        'w-full flex items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-all duration-150',
                        isWinner ? 'border-success-500/50 bg-success-500/[0.08]' :
                        isLoser  ? 'border-white/[0.04] bg-white/[0.01] opacity-50' :
                        isSelected ? 'border-primary-500/60 bg-primary-500/[0.08] shadow-[0_0_20px_rgba(59,130,246,0.1)]' :
                        'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]',
                      ].join(' ')}
                    >
                      {/* Outcome index indicator */}
                      <div className={[
                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                        isWinner ? 'bg-success-500 text-white' :
                        isSelected ? 'bg-primary-500 text-white' :
                        'bg-white/[0.06] text-slate-400',
                      ].join(' ')}>
                        {isWinner ? <FiCheck className="w-4 h-4" /> : String.fromCharCode(65 + index)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className={`font-semibold text-sm ${isLoser ? 'text-slate-500' : 'text-white'}`}>
                            {outcome.label}
                          </span>
                          <span className={`text-sm font-bold ${
                            isWinner ? 'text-success-400' :
                            isSelected ? 'text-primary-400' : 'text-slate-400'
                          }`}>
                            {outcome.pct}%
                          </span>
                        </div>
                        {/* Probability bar */}
                        <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${outcome.pct}%`,
                              background: isWinner
                                ? 'linear-gradient(90deg, #34D399, #10B981)'
                                : isSelected
                                ? 'linear-gradient(90deg, #60A5FA, #3B82F6)'
                                : 'rgba(148,163,184,0.25)',
                            }}
                          />
                        </div>
                      </div>

                      <div className="text-right text-xs text-slate-500 flex-shrink-0">
                        ${formatNumber(outcome.stake)} staked
                      </div>
                    </motion.button>
                  );
                })}

                {outcomeData.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Outcomes will appear once this market is fully initialized.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Right column: Trade panel ─────────────────── */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div
              className="rounded-2xl border border-[#1C2537] bg-[#0D1224] p-6"
              style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}
            >
              <h2 className="text-lg font-bold text-white mb-1">Place Prediction</h2>
              <p className="text-sm text-slate-500 mb-6">
                {market!.resolved
                  ? 'This market has been resolved.'
                  : isExpired
                  ? 'Market has closed. Awaiting resolution.'
                  : selectedOutcome
                  ? `You selected: ${selectedOutcome.label}`
                  : 'Select an outcome on the left to continue.'}
              </p>

              <AnimatePresence mode="wait">
                {selectedOutcome && !isExpired && (
                  <motion.div
                    key="selected"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="mb-5 rounded-xl border border-primary-500/30 bg-primary-500/[0.07] p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-primary-300">Selected</span>
                      <span className="text-lg font-black text-primary-300">{selectedOutcome.odds}%</span>
                    </div>
                    <div className="text-base font-bold text-white mb-1">{selectedOutcome.label}</div>
                    <div className="text-xs text-slate-500">Pool: {selectedOutcome.pool}</div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Key info */}
              {!market!.resolved && (
                <div className="space-y-2.5 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Total volume</span>
                    <span className="font-semibold text-white">{formatVolume(market!.totalStakes)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Closes</span>
                    <span className="font-semibold text-white">
                      {format(market!.endTime * 1000, 'MMM d, HH:mm')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Time left</span>
                    <span className={`font-semibold ${countdown.isExpired ? 'text-error-400' : 'text-white'}`}>
                      {timeLabel}
                    </span>
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                className={`w-full py-3.5 text-base font-bold rounded-xl border-0 transition-all ${
                  selectedOutcome && !isExpired
                    ? '!bg-gradient-to-r from-primary-500 to-secondary-600 shadow-[0_0_24px_rgba(59,130,246,0.3)] hover:shadow-[0_0_36px_rgba(59,130,246,0.45)]'
                    : ''
                }`}
                disabled={!selectedOutcome || isExpired}
                onClick={() => selectedOutcome && setBetModalOpen(true)}
              >
                {market!.resolved
                  ? 'Market Resolved'
                  : isExpired
                  ? 'Market Closed'
                  : selectedOutcome
                  ? `Bet on "${selectedOutcome.label}"`
                  : 'Select an Outcome'}
              </Button>

              {!isExpired && (
                <p className="mt-3 text-center text-xs text-slate-600">
                  Bets are non-withdrawable. Min bet:{' '}
                  <span className="text-slate-500">${VALIDATION_CONSTANTS.MIN_BET_USDC} USDC</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </Container>

      {/* Betting modal */}
      {market && selectedOutcome && selectedOutcomeIndex !== null && (
        <BettingModal
          isOpen={betModalOpen}
          onClose={() => setBetModalOpen(false)}
          market={{
            marketId: market.id.toString(),
            onChainId: market.id.toString(),
            question,
            outcomeLabel: selectedOutcome.label,
            currentOdds: selectedOutcome.odds,
            pool: selectedOutcome.pool,
          }}
          outcomeIndex={selectedOutcomeIndex}
          onSubmit={async (amount) => {
            const tx = await placeBet(market.id, selectedOutcomeIndex, amount);
            if (tx) { setBetModalOpen(false); return true; }
            return false;
          }}
          isSubmitting={isPlacingBet}
          minBetUSDC={VALIDATION_CONSTANTS.MIN_BET_USDC}
        />
      )}
    </div>
  );
};

export default MarketDetailPage;
