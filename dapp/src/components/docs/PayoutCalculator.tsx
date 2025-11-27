import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { FiDollarSign, FiTrendingUp, FiPercent } from 'react-icons/fi';

export const PayoutCalculator: React.FC = () => {
  const [yesPool, setYesPool] = useState(30000);
  const [noPool, setNoPool] = useState(20000);
  const [betAmount, setBetAmount] = useState(1000);
  const [betSide, setBetSide] = useState<'yes' | 'no'>('yes');
  const platformFee = 0.02; // 2%

  const calculation = useMemo(() => {
    const totalPool = yesPool + noPool;
    const yourPool = betSide === 'yes' ? yesPool : noPool;
    const oppositePool = betSide === 'yes' ? noPool : yesPool;

    // Your share of the winning pool
    const yourShare = betAmount / (yourPool + betAmount);

    // Amount you receive from losing pool
    const winnings = oppositePool * yourShare;

    // Platform fee on winnings only
    const fee = winnings * platformFee;

    // Total payout = your bet back + winnings - fee
    const totalPayout = betAmount + winnings - fee;
    const profit = totalPayout - betAmount;
    const roi = (profit / betAmount) * 100;

    // Odds calculation
    const yourPoolAfterBet = yourPool + betAmount;
    const impliedProbability = (yourPoolAfterBet / (totalPool + betAmount)) * 100;

    return {
      totalPool,
      yourShare: yourShare * 100,
      winnings,
      fee,
      totalPayout,
      profit,
      roi,
      impliedProbability,
    };
  }, [yesPool, noPool, betAmount, betSide]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FiDollarSign className="w-5 h-5 text-primary-500" />
          Interactive Payout Calculator
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Adjust the values below to see how payouts are calculated in real-time
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Market Pools */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Yes Pool (USDC)
              </label>
              <input
                type="number"
                value={yesPool}
                onChange={(e) => setYesPool(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                min="100"
                step="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                No Pool (USDC)
              </label>
              <input
                type="number"
                value={noPool}
                onChange={(e) => setNoPool(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                min="100"
                step="100"
              />
            </div>
          </div>

          {/* Your Bet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Bet Amount (USDC)
            </label>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              min="1"
              step="10"
            />
          </div>

          {/* Bet Side Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Prediction
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setBetSide('yes')}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                  betSide === 'yes'
                    ? 'bg-success-500 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                YES
              </button>
              <button
                onClick={() => setBetSide('no')}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                  betSide === 'no'
                    ? 'bg-error-500 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                NO
              </button>
            </div>
          </div>

          {/* Market Stats */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Market Pool:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {calculation.totalPool.toLocaleString()} USDC
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <FiPercent className="w-4 h-4" />
                Implied Probability ({betSide.toUpperCase()}):
              </span>
              <span className="font-semibold text-primary-600 dark:text-primary-400">
                {calculation.impliedProbability.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Your Share of Pool:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {calculation.yourShare.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Payout Breakdown */}
          <div className="bg-gradient-to-br from-success-50 to-success-100 dark:from-success-900/20 dark:to-success-800/20 rounded-lg p-6 space-y-3">
            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <FiTrendingUp className="w-5 h-5 text-success-600" />
              If You Win
            </h4>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Your bet returns:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {betAmount.toLocaleString()} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">
                  Winnings from {betSide === 'yes' ? 'NO' : 'YES'} pool:
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  +{calculation.winnings.toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Platform fee (2%):</span>
                <span className="font-medium text-error-600">
                  -{calculation.fee.toFixed(2)} USDC
                </span>
              </div>
              <div className="border-t-2 border-success-300 dark:border-success-700 pt-2 mt-2"></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-900 dark:text-white font-semibold text-base">
                  Total Payout:
                </span>
                <span className="font-bold text-success-600 dark:text-success-400 text-lg">
                  {calculation.totalPayout.toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-900 dark:text-white font-semibold">Net Profit:</span>
                <span className={`font-bold text-lg ${
                  calculation.profit > 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600'
                }`}>
                  {calculation.profit > 0 ? '+' : ''}{calculation.profit.toFixed(2)} USDC
                  <span className="text-sm ml-2">
                    ({calculation.roi > 0 ? '+' : ''}{calculation.roi.toFixed(1)}%)
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Note:</strong> This calculator assumes you win. If the opposite outcome occurs,
              you will lose your entire bet amount of {betAmount.toLocaleString()} USDC.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
