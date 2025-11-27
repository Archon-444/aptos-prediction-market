import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiAlertCircle, FiDollarSign, FiTrendingUp } from 'react-icons/fi';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useChainCurrency } from '../hooks/useChainCurrency';
import { useDebounce } from '../hooks/useDebounce';
import { useSDKContext } from '../contexts/SDKContext';
import { fetchPayoutQuote, type PayoutQuote } from '../services/payoutApi';

interface BettingMarketInfo {
  marketId?: string;
  onChainId: string;
  question: string;
  outcomeLabel: string;
  currentOdds: number;
  pool: string;
}

interface BettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: BettingMarketInfo;
  outcomeIndex: number;
  onSubmit: (amount: number) => Promise<boolean>;
  isSubmitting: boolean;
  minBetUSDC?: number;
}

export const BettingModal: React.FC<BettingModalProps> = ({
  isOpen,
  onClose,
  market,
  outcomeIndex,
  onSubmit,
  isSubmitting,
  minBetUSDC = 1,
}) => {
  const [amount, setAmount] = useState('');
  const [payoutData, setPayoutData] = useState<PayoutQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const currency = useChainCurrency();
  const { chain } = useSDKContext();
  const debouncedAmount = useDebounce(parseFloat(amount) || 0, 400);

  const InputIcon = useMemo(() => {
    if (currency.chain === 'sui') {
      return <span className="text-lg font-semibold text-gray-500" aria-hidden="true">◊</span>;
    }
    return <FiDollarSign className="w-5 h-5 text-gray-400" aria-hidden="true" />;
  }, [currency]);

  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setPayoutData(null);
      setQuoteError(null);
      setIsQuoteLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!market.onChainId || debouncedAmount <= 0 || Number.isNaN(debouncedAmount)) {
      setPayoutData(null);
      setQuoteError(null);
      setIsQuoteLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsQuoteLoading(true);
    setQuoteError(null);

    fetchPayoutQuote(
      {
        chain,
        onChainId: market.onChainId,
        outcomeIndex,
        amount: debouncedAmount,
        ...(market.marketId ? { marketId: market.marketId } : {}),
      },
      { signal: controller.signal }
    )
      .then((quote) => {
        setPayoutData(quote);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unable to calculate payout';
        setQuoteError(message);
        setPayoutData(null);
      })
      .finally(() => {
        setIsQuoteLoading(false);
      });

    return () => controller.abort();
  }, [chain, debouncedAmount, isOpen, market.onChainId, outcomeIndex]);

  const numAmount = parseFloat(amount) || 0;
  const fallbackPayout =
    numAmount > 0 && market.currentOdds > 0 ? (numAmount / market.currentOdds) * 100 : 0;
  const estimatedPayout = payoutData?.estimatedPayout ?? fallbackPayout;
  const potentialProfit = payoutData?.potentialProfit ?? (estimatedPayout - numAmount);
  const formattedStake = currency.formatDisplay(numAmount);
  const formattedPayout = currency.formatDisplay(estimatedPayout);
  const profitSign = potentialProfit >= 0 ? '+' : '-';
  const formattedProfit = currency.formatDisplay(Math.abs(potentialProfit));
  const totalFees = payoutData?.fees.total ?? Math.max(numAmount * 0.02, 0);
  const chainLabel = chain === 'aptos'
    ? 'Aptos'
    : chain === 'sui'
      ? 'Sui'
      : 'Movement';

  const outcomeVariant =
    market.outcomeLabel.toLowerCase().startsWith('no') ||
    market.outcomeLabel.toLowerCase().includes('no')
      ? 'error'
      : 'success';

  const handleSubmit = async () => {
    if (!amount || numAmount <= 0) return;
    const success = await onSubmit(numAmount);
    if (success) {
      setAmount('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Place Your Bet" size="md">
      <div className="space-y-6">
        {/* Market Info */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <div className="text-sm text-gray-600 mb-2">Betting on</div>
          <div className="font-display font-semibold text-gray-900 mb-3 line-clamp-2">
            {market.question}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant={outcomeVariant}
                className="uppercase"
              >
                {market.outcomeLabel}
              </Badge>
              <span className="text-sm text-gray-600">Current Odds:</span>
              <span className="font-semibold text-gray-900">{market.currentOdds}%</span>
            </div>
            <div className="text-sm text-gray-600">
              Pool: <span className="font-semibold text-gray-900">{market.pool}</span>
            </div>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <Input
            label={`Bet Amount (${currency.unitLabel})`}
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            leftIcon={InputIcon}
            helperText={`Minimum bet: ${minBetUSDC} ${currency.unitLabel}`}
          />

          {quoteError && (
            <div className="mt-2 flex items-center gap-2 text-sm text-error-600">
              <FiAlertCircle className="w-4 h-4" aria-hidden="true" />
              <span>{quoteError}</span>
            </div>
          )}

          {/* Preset Amounts */}
          <div className="grid grid-cols-4 gap-2 mt-3" role="group" aria-label="Preset bet amounts">
            {currency.presetAmounts.map((preset) => {
              const presetLabel = currency.symbolPrefix
                ? `${currency.symbolPrefix}${preset}`
                : `${preset} ${currency.unitLabel}`;
              return (
                <button
                  key={preset}
                  onClick={() => setAmount(preset.toString())}
                  aria-label={`Set bet amount to ${preset} ${currency.unitLabel}`}
                  className="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-primary-500 hover:text-primary-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
                >
                  {presetLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Calculation Preview */}
        {numAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-primary-50 border border-primary-100 rounded-xl space-y-3"
          >
            {isQuoteLoading && (
              <div className="text-xs text-primary-600" role="status">
                Calculating payout for {chainLabel}...
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Your Stake</span>
              <span className="font-semibold text-gray-900">{formattedStake}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Estimated Payout</span>
              <span className="font-semibold text-gray-900">
                {formattedPayout}
              </span>
            </div>
            {payoutData?.shares && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Shares Purchased</span>
                <span className="font-semibold text-gray-900">
                  {currency.formatDisplay(Math.max(payoutData.shares.decimal, 0))}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Estimated Fees</span>
              <span className="font-semibold text-gray-900">
                {currency.formatDisplay(Math.max(totalFees, 0))}
              </span>
            </div>
            {typeof payoutData?.priceImpact === 'number' && (
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Price Impact</span>
                <span>
                  {currency.formatDisplay(Math.max(payoutData.priceImpact, 0))}
                </span>
              </div>
            )}
            {payoutData?.fees && (
              <div className="grid grid-cols-1 gap-1 text-xs text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Trading</span>
                  <span>{currency.formatDisplay(Math.max(payoutData.fees.trading, 0))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Creator</span>
                  <span>{currency.formatDisplay(Math.max(payoutData.fees.creator, 0))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Protocol</span>
                  <span>{currency.formatDisplay(Math.max(payoutData.fees.protocol, 0))}</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between text-sm pt-3 border-t border-primary-200">
              <span className="text-gray-600 flex items-center gap-1">
                <FiTrendingUp className="w-4 h-4" />
                Potential Profit
              </span>
              <span
                className={`font-bold ${
                  potentialProfit > 0 ? 'text-success-600' : 'text-error-600'
                }`}
              >
                {potentialProfit === 0
                  ? currency.formatDisplay(0)
                  : `${profitSign}${formattedProfit}`}
              </span>
            </div>
          </motion.div>
        )}

        {/* Warning */}
        <div className="flex gap-3 p-4 bg-warning-50 border border-warning-200 rounded-xl">
          <FiAlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-warning-800">
            <div className="font-semibold mb-1">Important</div>
            <div>
              Bets are final and cannot be withdrawn. Odds may change before your transaction
              is confirmed. Estimated total fees on {chainLabel}: {currency.formatDisplay(Math.max(totalFees, 0))}.
              Fee structure varies per chain and is applied automatically on winnings.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} fullWidth disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            fullWidth
            disabled={!amount || numAmount < minBetUSDC || isSubmitting}
            loading={isSubmitting}
            rightIcon={
              currency.chain === 'sui'
                ? <span className="text-sm font-semibold">◊</span>
                : <FiDollarSign />
            }
          >
            {isSubmitting ? 'Confirming...' : 'Confirm Bet'}
          </Button>
        </div>

        {/* Transaction Info */}
        <div className="text-xs text-gray-500 text-center">
          By confirming, you agree to our{' '}
          <a href="/terms" className="text-primary-500 hover:underline">
            Terms of Service
          </a>
          . Transaction will require wallet approval.
        </div>
      </div>
    </Modal>
  );
};

export default BettingModal;
