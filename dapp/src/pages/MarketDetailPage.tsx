import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FiClock, FiTrendingUp, FiDollarSign, FiLayers } from 'react-icons/fi';
import { format } from 'date-fns';
import { Container } from '../components/layout/Container';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useCountdown } from '../hooks/useCountdown';
import { useMarket } from '../hooks/useMarkets';
import MarketResolutionPanel from '../components/MarketResolutionPanel';
import { fromMicroUSDC, VALIDATION_CONSTANTS } from '../utils/validation';
import { sanitizeMarketQuestion } from '../utils/sanitize';
import BettingModal from '../components/BettingModal';
import { usePlaceBet } from '../hooks/useTransactions';

// TODO: integrate historical odds/volume charts once backend endpoints are exposed.

const formatAddress = (address: string): string => {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatNumber = (value: number, fractionDigits = 2): string =>
  value.toLocaleString('en-US', { maximumFractionDigits: fractionDigits });

const getTimeRemaining = (isExpired: boolean, countdown: ReturnType<typeof useCountdown>): string => {
  if (isExpired) {
    return 'Market closed';
  }
  const { days, hours, minutes, seconds } = countdown;
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
};

export const MarketDetailPage: React.FC = () => {
  const { id } = useParams();
  const marketId = useMemo(() => {
    if (!id) {
      return null;
    }
    const parsed = Number(id);
    return Number.isNaN(parsed) ? null : parsed;
  }, [id]);

  const { market, isLoading, error } = useMarket(marketId);
  const { placeBet, isLoading: isPlacingBet } = usePlaceBet();
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState<number | null>(null);
  const [betModalOpen, setBetModalOpen] = useState(false);

  const countdown = useCountdown(market ? market.endTime * 1000 : Date.now());
  const totalStakes = market ? fromMicroUSDC(market.totalStakes) : 0;

  const outcomeData = useMemo(() => {
    if (!market) {
      return [];
    }
    return market.outcomes.map((label, index) => ({
      label,
      stake: fromMicroUSDC(market.outcomeStakes[index] ?? 0),
    }));
  }, [market]);

  const question = market ? sanitizeMarketQuestion(market.question) : '';

  const selectedOutcome = useMemo(() => {
    if (selectedOutcomeIndex === null || !market) {
      return null;
    }
    const label = market.outcomes[selectedOutcomeIndex];
    const stake = fromMicroUSDC(market.outcomeStakes[selectedOutcomeIndex] ?? 0);
    const total = totalStakes;
    const odds = total > 0 ? Math.round((stake / total) * 100) : 0;
    return {
      label,
      odds,
      pool: `$${formatNumber(stake)}`,
    };
  }, [selectedOutcomeIndex, market, totalStakes]);

  const handleParticipate = () => {
    if (!selectedOutcome || !market) {
      return;
    }
    setBetModalOpen(true);
  };

  const handleCloseModal = () => setBetModalOpen(false);

  const handleSubmitBet = async (amountUSDC: number): Promise<boolean> => {
    if (!market || selectedOutcomeIndex === null) {
      return false;
    }
    const txHash = await placeBet(market.id, selectedOutcomeIndex, amountUSDC);
    if (txHash) {
      setBetModalOpen(false);
      return true;
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Container size="xl" className="py-10 space-y-6">
        {isLoading && (
          <Card padding="lg" className="animate-pulse h-64">
            <div className="text-gray-400">Loading market...</div>
          </Card>
        )}

        {!isLoading && error && (
          <Card padding="lg" className="border-error-200 bg-error-50 text-error-700">
            <div>{error.message}</div>
          </Card>
        )}

        {!isLoading && !error && !market && (
          <Card padding="lg">
            <CardTitle>Market not found</CardTitle>
            <CardDescription>
              We couldn&apos;t locate this market. It may have been removed or the identifier is incorrect.
            </CardDescription>
          </Card>
        )}

        {market && (
          <>
            <MarketResolutionPanel marketId={marketId} />

            <Card padding="lg">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <Badge variant="primary">Market #{market.id}</Badge>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <FiClock className="w-4 h-4" />
                  <span className="font-medium">
                    {getTimeRemaining(countdown.isExpired, countdown)}
                  </span>
                </div>
              </div>

              <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 dark:text-white mb-4 transition-colors">
                {question}
              </h1>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Created by <span className="font-mono">{formatAddress(market.creator)}</span>{' '}
                on{' '}
                {format(market.createdAt * 1000, 'PPP HH:mm')}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-1">
                    <FiTrendingUp className="w-4 h-4" />
                    Total Stakes
                  </div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-white">
                    ${formatNumber(totalStakes)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-1">
                    <FiLayers className="w-4 h-4" />
                    Outcomes
                  </div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-white">
                    {market.outcomes.length}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-1">
                    <FiClock className="w-4 h-4" />
                    Ends
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {format(market.endTime * 1000, 'PPP HH:mm')}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-1">
                    <FiDollarSign className="w-4 h-4" />
                    Resolved
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {market.resolved ? 'Yes' : 'Not yet'}
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="lg">
              <CardHeader className="mb-4">
                <CardTitle>Outcomes & Stakes</CardTitle>
                <CardDescription>
                  Distribution of total stakes across available outcomes. Select one to place a prediction.
                </CardDescription>
              </CardHeader>

              <div className="space-y-3">
                {outcomeData.map((outcome, index) => (
                  <button
                    key={`${outcome.label}-${index}`}
                    type="button"
                    onClick={() => setSelectedOutcomeIndex(index)}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                      selectedOutcomeIndex === index
                        ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {outcome.label}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      ${formatNumber(outcome.stake)}
                    </div>
                  </button>
                ))}
                {outcomeData.length === 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Outcomes will appear once this market is fully initialized.
                  </p>
                )}
              </div>
            </Card>

            <Card padding="lg">
              <CardHeader className="mb-4">
                <CardTitle>Participate</CardTitle>
                <CardDescription>
                  Select an outcome and place your prediction.
                </CardDescription>
              </CardHeader>
              <Button
                variant="primary"
                className="w-full md:w-auto"
                disabled={!selectedOutcome}
                onClick={handleParticipate}
              >
                {selectedOutcome ? `Bet on "${selectedOutcome.label}"` : 'Select an outcome'}
              </Button>
            </Card>
          </>
        )}

        {market && selectedOutcome && selectedOutcomeIndex !== null && (
          <BettingModal
            isOpen={betModalOpen}
            onClose={handleCloseModal}
            market={{
              marketId: market.id.toString(),
              onChainId: market.id.toString(),
              question,
              outcomeLabel: selectedOutcome.label,
              currentOdds: selectedOutcome.odds,
              pool: selectedOutcome.pool,
            }}
            outcomeIndex={selectedOutcomeIndex}
            onSubmit={handleSubmitBet}
            isSubmitting={isPlacingBet}
            minBetUSDC={VALIDATION_CONSTANTS.MIN_BET_USDC}
          />
        )}
      </Container>
    </div>
  );
};

export default MarketDetailPage;
