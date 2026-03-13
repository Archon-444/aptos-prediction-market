import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from '../components/ui/Toast';
import { useCreateMarket } from '../hooks/useTransactions';
import { submitMarketSuggestion } from '../services/suggestionsApi';
import { useHasMarketCreatorRole } from '../hooks/useRoles';
import { Select } from '../components/ui/Select';
import { useUnifiedWallet } from '../hooks/useUnifiedWallet';
import { useChain } from '../contexts/ChainContext';
import { PremiumContainer } from '../components/layout/PremiumContainer';

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General', icon: '📋' },
  { value: 'crypto', label: 'Cryptocurrency', icon: '₿' },
  { value: 'sports', label: 'Sports', icon: '⚽' },
  { value: 'politics', label: 'Politics', icon: '🏛️' },
  { value: 'technology', label: 'Technology', icon: '💻' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'science', label: 'Science', icon: '🔬' },
];

const creatorChains = ['aptos', 'sui'] as const;

const HOURS_IN_MS = 60 * 60 * 1000;
const DEFAULT_DURATION_HOURS = 24 * 7;

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);
const toTimeInputValue = (date: Date) => date.toISOString().slice(11, 16);

export default function CreateMarketPage() {
  const navigate = useNavigate();
  const { activeChain } = useChain();
  const { connected, address, publicKey, signMessage } = useUnifiedWallet();
  const { createMarket, isLoading } = useCreateMarket();
  const { hasRole: hasCreatorRole, loading: roleLoading } = useHasMarketCreatorRole();

  const [question, setQuestion] = useState('');
  const [marketType, setMarketType] = useState<'binary' | 'multi'>('binary');
  const [outcomes, setOutcomes] = useState(['Yes', 'No']);

  const defaultEndDate = useMemo(() => {
    const target = new Date(Date.now() + DEFAULT_DURATION_HOURS * HOURS_IN_MS);
    return toDateInputValue(target);
  }, []);

  const defaultEndTime = useMemo(() => {
    const target = new Date(Date.now() + DEFAULT_DURATION_HOURS * HOURS_IN_MS);
    return toTimeInputValue(target);
  }, []);

  const [endDate, setEndDate] = useState(defaultEndDate);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [category, setCategory] = useState('general');
  const [resolutionSource, setResolutionSource] = useState('');
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);

  const chainLabel =
    activeChain === 'aptos' ? 'Aptos' : activeChain === 'sui' ? 'Sui' : 'Movement';

  const setBinaryOutcomes = () => {
    setMarketType('binary');
    setOutcomes(['Yes', 'No']);
  };

  const handleAddOutcome = () => {
    if (marketType === 'binary') return;
    if (outcomes.length < 10) {
      setOutcomes([...outcomes, '']);
    }
  };

  const handleRemoveOutcome = (index: number) => {
    if (marketType === 'binary') return;
    if (outcomes.length > 2) {
      setOutcomes(outcomes.filter((_, i) => i !== index));
    }
  };

  const handleOutcomeChange = (index: number, value: string) => {
    if (marketType === 'binary') return;
    const next = [...outcomes];
    next[index] = value;
    setOutcomes(next);
  };

  const applyDurationPreset = (hours: number) => {
    const target = new Date(Date.now() + hours * HOURS_IN_MS);
    setEndDate(toDateInputValue(target));
    setEndTime(toTimeInputValue(target));
  };

  const calculateDurationHours = () => {
    if (!endDate || !endTime) return 0;
    const endDateTime = new Date(`${endDate}T${endTime}`);
    const deltaMs = endDateTime.getTime() - Date.now();
    if (Number.isNaN(deltaMs) || deltaMs <= 0) return 0;
    return Math.ceil(deltaMs / HOURS_IN_MS);
  };

  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!address) {
      toast.error('Unable to detect your wallet address');
      return;
    }

    const filledOutcomes = outcomes.map((item) => item.trim()).filter(Boolean);

    if (filledOutcomes.length < 2) {
      toast.error('Please provide at least 2 outcomes');
      return;
    }

    const durationHours = calculateDurationHours();
    if (durationHours <= 0) {
      toast.error('Please pick a future settlement time');
      return;
    }

    try {
      setIsSubmittingSuggestion(true);

      if (!signMessage || !publicKey) {
        throw new Error('Wallet does not support message signing');
      }

      await submitMarketSuggestion(
        {
          address,
          publicKey,
          chain: activeChain,
          signMessage,
        },
        {
          question: question.trim(),
          outcomes: filledOutcomes,
          category,
          durationHours,
          resolutionSource: resolutionSource.trim() || undefined,
          chain: activeChain,
        }
      );

      toast.success('Market suggestion submitted for review! The DAO will review your proposal.');

      setQuestion('');
      setBinaryOutcomes();
      setResolutionSource('');
      setCategory('general');
      applyDurationPreset(DEFAULT_DURATION_HOURS);

      setTimeout(() => {
        navigate('/markets');
      }, 1500);
    } catch (error: any) {
      console.error('[CreateMarketPage] Failed to submit suggestion:', error);
      toast.error(error?.message ?? 'Failed to submit suggestion. Please try again.');
    } finally {
      setIsSubmittingSuggestion(false);
    }
  };

  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!address) {
      toast.error('Unable to detect your wallet address');
      return;
    }

    if (!(creatorChains as readonly string[]).includes(activeChain)) {
      toast.error(
        'Direct on-chain publication is only available on Aptos or Sui. Switch chains or submit a suggestion instead.'
      );
      return;
    }

    const filledOutcomes = outcomes.map((item) => item.trim()).filter(Boolean);
    if (filledOutcomes.length < 2) {
      toast.error('Please provide at least 2 outcomes');
      return;
    }

    const durationHours = calculateDurationHours();
    if (durationHours <= 0) {
      toast.error('Please pick a future settlement time');
      return;
    }

    const hash = await createMarket(question, filledOutcomes, durationHours);

    if (hash) {
      setTimeout(() => {
        navigate('/markets');
      }, 2000);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#050713] text-white selection:bg-primary-500/30">
        <PremiumContainer size="sm">
          <div className="bg-warning-900/20 border border-warning-500/30 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-bold text-warning-200 mb-2">
              Wallet Connection Required
            </h2>
            <p className="text-warning-100/80">
              Please connect your wallet to {(hasCreatorRole && activeChain === 'aptos') ? 'create' : 'suggest'} a market.
            </p>
          </div>
        </PremiumContainer>
      </div>
    );
  }

  const isCreatorMode =
    hasCreatorRole && !roleLoading && (creatorChains as readonly string[]).includes(activeChain);

  return (
    <div className="min-h-screen bg-[#050713] text-white selection:bg-primary-500/30">
      <PremiumContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">
              {isCreatorMode ? 'Create New Market' : 'Suggest a Market'}
            </h1>
            <div className="mt-3 inline-flex flex-wrap items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-300">
              <span className="font-semibold text-white">Active Chain:</span>
              <span className="inline-flex items-center rounded-full bg-primary-500/20 text-primary-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                {chainLabel}
              </span>
              {address && (
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 font-mono text-xs text-gray-300">
                  {address.slice(0, 6)}…{address.slice(-4)}
                </span>
              )}
              <span className="text-xs text-gray-400">
                Suggestions will route to the {chainLabel} review queue.
              </span>
            </div>
            {roleLoading && (
              <p className="mt-2 text-sm text-gray-400">
                Checking creator permissions...
              </p>
            )}
            {!isCreatorMode && (
              <p className="mt-2 text-gray-400">
                Your suggestion will be reviewed by the DAO before being published.
              </p>
            )}
            {isCreatorMode && (
              <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-success-500/20 text-success-200 text-sm font-medium">
                Creator Mode Enabled
              </div>
            )}
          </div>

          <form
            onSubmit={isCreatorMode ? handleCreateMarket : handleSubmitSuggestion}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Question
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 placeholder-gray-500"
                placeholder="e.g. Will BTC close above $80k on 31 Dec 2025?"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Market Type
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={setBinaryOutcomes}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition ${marketType === 'binary'
                      ? 'bg-primary-500/20 border-primary-500 text-primary-200'
                      : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                >
                  Binary (Yes / No)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMarketType('multi');
                    setOutcomes(['', '']);
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition ${marketType === 'multi'
                      ? 'bg-primary-500/20 border-primary-500 text-primary-200'
                      : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                >
                  Multiple Choice
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-300">
                  Outcomes
                </label>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {marketType === 'multi'
                    ? 'Minimum 2, maximum 10'
                    : 'Binary markets automatically use Yes / No'}
                  {marketType === 'multi' && (
                    <button
                      type="button"
                      onClick={setBinaryOutcomes}
                      className="text-primary-400 hover:text-primary-300"
                    >
                      Quick set Yes / No
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {outcomes.map((outcome, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={outcome}
                      onChange={(e) => handleOutcomeChange(index, e.target.value)}
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 placeholder-gray-500"
                      placeholder={`Outcome ${index + 1}`}
                      readOnly={marketType === 'binary'}
                    />
                    {outcomes.length > 2 && marketType === 'multi' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOutcome(index)}
                        className="text-xs text-error-400 hover:text-error-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {outcomes.length < 10 && marketType === 'multi' && (
                <button
                  type="button"
                  onClick={handleAddOutcome}
                  className="text-sm text-primary-400 hover:text-primary-300"
                >
                  + Add outcome
                </button>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Market Settlement Deadline
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 [color-scheme:dark]"
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 [color-scheme:dark]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                <span>Quick presets:</span>
                {[24, 72, 24 * 7, 24 * 30].map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => applyDurationPreset(hours)}
                    className="px-2 py-1 rounded-full border border-white/10 hover:border-primary-500 hover:text-primary-300"
                  >
                    +{hours >= 24 ? `${hours / 24}${hours % 24 === 0 ? 'd' : 'h'}` : `${hours}h`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                We’ll automatically convert this to contract hours. Markets must close in the future.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Category
              </label>
              <Select
                options={CATEGORY_OPTIONS}
                value={category}
                onChange={setCategory}
                placeholder="Select a category"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Resolution Source (optional)
              </label>
              <input
                type="text"
                value={resolutionSource}
                onChange={(e) => setResolutionSource(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 placeholder-gray-500"
                placeholder="e.g. https://data.provider.com/oracle-feed"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 font-medium text-white shadow hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 w-full md:w-auto"
              disabled={isCreatorMode ? isLoading : isSubmittingSuggestion}
            >
              {isCreatorMode
                ? isLoading
                  ? 'Publishing...'
                  : 'Publish on-chain'
                : isSubmittingSuggestion
                  ? 'Submitting...'
                  : 'Submit suggestion'}
            </button>
          </form>
        </motion.div>
      </PremiumContainer>
    </div>
  );
}
