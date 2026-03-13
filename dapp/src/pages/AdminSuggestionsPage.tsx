import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUnifiedWallet } from '../hooks/useUnifiedWallet';
import toast from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import {
  MarketSuggestion,
  MarketSuggestionStatus,
  SuggestionEvent,
  fetchMarketSuggestions,
  fetchSuggestionEvents,
  reviewMarketSuggestion,
  voteOnSuggestion,
} from '../services/suggestionsApi';
import { useHasMarketCreatorRole, useIsAdmin } from '../hooks/useRoles';
import { useCreateMarket } from '../hooks/useTransactions';
import { useChain } from '../contexts/ChainContext';
import { FiChevronDown } from 'react-icons/fi';
import { PremiumContainer } from '../components/layout/PremiumContainer';

const statusLabels: Record<MarketSuggestionStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
};

const statusBadgeClasses: Record<MarketSuggestionStatus, string> = {
  pending: 'bg-warning-500/20 text-warning-200',
  approved: 'bg-success-500/20 text-success-200',
  rejected: 'bg-error-500/20 text-error-200',
  published: 'bg-primary-500/20 text-primary-200',
};

const chainBadgeClasses: Record<'aptos' | 'sui' | 'movement', string> = {
  aptos: 'bg-primary-500/20 text-primary-200',
  sui: 'bg-secondary-500/20 text-secondary-200',
  movement: 'bg-white/10 text-gray-300',
};

const chainLabels: Record<'aptos' | 'sui' | 'movement', string> = {
  aptos: 'Aptos',
  sui: 'Sui',
  movement: 'Movement',
};

const STATUS_FILTER_OPTIONS: { value: MarketSuggestionStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'published', label: 'Published' },
  { value: 'all', label: 'All' },
];

const AdminSuggestionsPage: React.FC = () => {
  const { connected, address, publicKey, signMessage } = useUnifiedWallet();
  const { hasRole: isAdmin, loading: adminLoading } = useIsAdmin();
  const { hasRole: hasCreatorRole } = useHasMarketCreatorRole();
  const { createMarket, isLoading: creatingMarket } = useCreateMarket();
  const { activeChain } = useChain();

  const [suggestions, setSuggestions] = useState<MarketSuggestion[]>([]);
  const [statusFilter, setStatusFilter] = useState<MarketSuggestionStatus | 'all'>('pending');
  const [isFetching, setIsFetching] = useState(false);
  const [events, setEvents] = useState<SuggestionEvent[]>([]);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const canModerate = connected && (isAdmin || hasCreatorRole);

  const filteredSuggestions = useMemo(() => {
    if (statusFilter === 'all') {
      return suggestions;
    }
    return suggestions.filter((item) => item.status === statusFilter);
  }, [suggestions, statusFilter]);

  const refreshSuggestions = useCallback(async () => {
    try {
      setIsFetching(true);
      const results = await fetchMarketSuggestions(
        statusFilter === 'all' ? undefined : statusFilter,
        activeChain
      );
      setSuggestions(results);

      if (address && publicKey && signMessage) {
        const eventResponses = await Promise.all(
          results.map(async (item) => {
            try {
              return await fetchSuggestionEvents(
                {
                  address,
                  publicKey,
                  chain: activeChain,
                  signMessage,
                },
                item.id,
                activeChain
              );
            } catch (error) {
              console.error('[AdminSuggestionsPage] Failed to fetch events for suggestion:', item.id, error);
              return [];
            }
          })
        );

        setEvents(eventResponses.flat());
      } else {
        setEvents([]);
      }
    } catch (error: any) {
      console.error('[AdminSuggestionsPage] Failed to fetch suggestions:', error);
      toast.error(error?.message ?? 'Unable to load suggestions');
    } finally {
      setIsFetching(false);
    }
  }, [statusFilter, address, activeChain, publicKey, signMessage]);

  useEffect(() => {
    refreshSuggestions();
  }, [refreshSuggestions]);

  const updateSuggestionLocally = (updated: MarketSuggestion) => {
    setSuggestions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

    if (!address || !publicKey || !signMessage) {
      return;
    }

    fetchSuggestionEvents(
      {
        address,
        publicKey,
        chain: activeChain,
        signMessage,
      },
      updated.id,
      activeChain
    )
      .then((history) => {
        setEvents((prev) => {
          const others = prev.filter((event) => event.suggestionId !== updated.id);
          return [...others, ...history];
        });
      })
      .catch((error) => {
        console.error('[AdminSuggestionsPage] Failed to refresh events for suggestion:', updated.id, error);
      });
  };

  const handleVote = async (suggestion: MarketSuggestion, delta: number) => {
    if (!address || !publicKey || !signMessage) {
      toast.error('Wallet not connected');
      return;
    }

    try {
      const updated = await voteOnSuggestion(
        {
          address,
          publicKey,
          chain: activeChain,
          signMessage,
        },
        suggestion.id,
        delta,
        activeChain
      );
      if (updated) {
        updateSuggestionLocally(updated);
      }
    } catch (error: any) {
      console.error('[AdminSuggestionsPage] Failed to record vote:', error);
      toast.error(error?.message ?? 'Unable to record vote');
    }
  };

  const handleApprove = async (suggestion: MarketSuggestion, publishOnchain: boolean) => {
    if (!address || !publicKey || !signMessage) {
      toast.error('Wallet not connected');
      return;
    }

    if (publishOnchain && activeChain !== suggestion.chain) {
      toast.error(`Switch to the ${suggestion.chain.toUpperCase()} network to publish on-chain.`);
      return;
    }

    let txHash: string | undefined;

    try {
      if (publishOnchain) {
        const hash = await createMarket(suggestion.question, suggestion.outcomes, suggestion.durationHours);
        if (!hash) {
          toast.error('Transaction cancelled');
          return;
        }
        txHash = hash;
      }

      const updated = await reviewMarketSuggestion(
        {
          address,
          publicKey,
          chain: activeChain,
          signMessage,
        },
        suggestion.id,
        {
          status: 'approved',
          txHash,
          publishOnChain: publishOnchain,
          chain: activeChain,
        }
      );

      if (updated) {
        updateSuggestionLocally(updated);
        toast.success('Suggestion approved');
      }
    } catch (error: any) {
      console.error('[AdminSuggestionsPage] Failed to approve suggestion:', error);
      toast.error(error?.message ?? 'Failed to approve suggestion');
    }
  };

  const handleReject = async (suggestion: MarketSuggestion) => {
    if (!address || !publicKey || !signMessage) {
      toast.error('Wallet not connected');
      return;
    }

    const reason = window.prompt('Please provide a reason for rejection (optional):');

    try {
      const updated = await reviewMarketSuggestion(
        {
          address,
          publicKey,
          chain: activeChain,
          signMessage,
        },
        suggestion.id,
        {
          status: 'rejected',
          reason: reason ?? undefined,
          chain: activeChain,
        }
      );

      if (updated) {
        updateSuggestionLocally(updated);
        toast.success('Suggestion rejected');
      }
    } catch (error: any) {
      console.error('[AdminSuggestionsPage] Failed to reject suggestion:', error);
      toast.error(error?.message ?? 'Failed to reject suggestion');
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#050713] text-white selection:bg-primary-500/30">
        <PremiumContainer size="sm">
          <div className="bg-warning-900/20 border border-warning-500/30 rounded-xl p-6 text-center">
            <h2 className="text-xl font-semibold text-warning-200 mb-2">
              Wallet Connection Required
            </h2>
            <p className="text-warning-100/80">
              Connect a wallet with DAO permissions to review market suggestions.
            </p>
          </div>
        </PremiumContainer>
      </div>
    );
  }

  if (!canModerate) {
    return (
      <div className="min-h-screen bg-[#050713] text-white selection:bg-primary-500/30">
        <PremiumContainer size="sm">
          <div className="bg-error-900/20 border border-error-500/30 rounded-xl p-6 text-center">
            <h2 className="text-xl font-semibold text-error-200 mb-2">
              Insufficient Permissions
            </h2>
            <p className="text-error-100/80">
              This page is restricted to DAO admins and Market Creators.
            </p>
            {adminLoading && (
              <p className="mt-2 text-sm text-error-300">
                Checking your permissions, please wait...
              </p>
            )}
          </div>
        </PremiumContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050713] text-white selection:bg-primary-500/30">
      <PremiumContainer size="xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Suggestion Review Queue</h1>
              <p className="text-gray-400">
                Review and curate community proposals before publishing them as on-chain markets.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-sm text-gray-400 md:block">
                {filteredSuggestions.length} {filteredSuggestions.length === 1 ? 'proposal' : 'proposals'}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 shadow-sm">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Status
                </span>
                <div className="relative">
                  <button
                    onClick={() => setStatusMenuOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:border-primary-500 hover:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    aria-haspopup="listbox"
                    aria-expanded={statusMenuOpen}
                  >
                    {STATUS_FILTER_OPTIONS.find((opt) => opt.value === statusFilter)?.label ?? 'All'}
                    <FiChevronDown className={`h-4 w-4 transition-transform ${statusMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {statusMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setStatusMenuOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0A0E27] shadow-xl"
                        >
                          {STATUS_FILTER_OPTIONS.map((option) => {
                            const active = statusFilter === option.value;
                            return (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setStatusFilter(option.value);
                                  setStatusMenuOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${active
                                    ? 'bg-primary-500/20 text-primary-300 font-semibold'
                                    : 'text-gray-300 hover:bg-white/5'
                                  }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshSuggestions}
                  loading={isFetching}
                  className="rounded-full border-white/20 text-white hover:bg-white/10"
                >
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {filteredSuggestions.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
              <h3 className="text-lg font-semibold text-white mb-2">No suggestions found</h3>
              <p className="text-gray-400">
                {statusFilter === 'pending'
                  ? 'New market ideas will appear here as the community submits them.'
                  : 'Try selecting a different filter or check back later.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClasses[suggestion.status]}`}
                      >
                        {statusLabels[suggestion.status]}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border border-transparent ${chainBadgeClasses[suggestion.chain]}`}
                      >
                        {chainLabels[suggestion.chain]}
                      </span>
                      <span className="text-sm text-gray-400">
                        Submitted {new Date(suggestion.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-gray-400">
                      ID: {suggestion.id.slice(0, 10)}…
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        {suggestion.question}
                      </h2>
                      <p className="text-sm text-gray-400 mt-1">
                        Proposed by {suggestion.proposer}
                      </p>
                      {suggestion.chain !== activeChain && (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-warning-500/20 border border-warning-500/30 px-3 py-2 text-xs text-warning-200">
                          Switch to the {chainLabels[suggestion.chain]} network to publish this market on-chain.
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wide mb-1">
                          Outcomes
                        </h3>
                        <ul className="space-y-1">
                          {suggestion.outcomes.map((outcome, index) => (
                            <li
                              key={index}
                              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-200 text-sm"
                            >
                              {outcome}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wide mb-1">
                            Category
                          </h3>
                          <span className="inline-block px-3 py-2 bg-primary-500/20 text-primary-200 border border-primary-500/30 rounded-lg text-sm capitalize">
                            {suggestion.category}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wide mb-1">
                            Duration
                          </h3>
                          <p className="text-sm text-gray-300">
                            {suggestion.durationHours} hours (~{Math.floor(suggestion.durationHours / 24)} days)
                          </p>
                        </div>
                        {suggestion.resolutionSource && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wide mb-1">
                              Resolution Source
                            </h3>
                            <p className="text-sm text-gray-300 break-words">
                              {suggestion.resolutionSource}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {suggestion.reviewReason && (
                      <div className="p-3 rounded-lg bg-error-500/20 border border-error-500/30 text-sm text-error-200">
                        <strong>Reviewer Note:</strong> {suggestion.reviewReason}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="px-3 py-1 bg-white/10 text-gray-300 rounded-full text-xs font-semibold">
                        Votes: {suggestion.votes ?? 0}
                      </span>
                      {suggestion.status === 'pending' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleVote(suggestion, 1)}
                          disabled={creatingMarket}
                          className="bg-white/10 text-white hover:bg-white/20 border-transparent"
                        >
                          👍 Upvote
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 mt-4">
                      {suggestion.status === 'pending' && (
                        <>
                          <Button
                            variant="primary"
                            onClick={() => handleApprove(suggestion, false)}
                            disabled={creatingMarket}
                          >
                            Approve (No Publish)
                          </Button>
                          <Button
                            variant="success"
                            onClick={() => handleApprove(suggestion, true)}
                            disabled={creatingMarket}
                          >
                            Approve & Publish On-chain
                          </Button>
                          <Button
                            variant="error"
                            onClick={() => handleReject(suggestion)}
                            disabled={creatingMarket}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {suggestion.status !== 'pending' && suggestion.txHash && (
                        (() => {
                          const explorerUrl = suggestion.chain === 'sui'
                            ? `https://explorer.sui.io/txblock/${suggestion.txHash}?network=testnet`
                            : `https://explorer.aptoslabs.com/txn/${suggestion.txHash}?network=devnet`;
                          return (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary-300 hover:underline"
                            >
                              View transaction
                            </a>
                          );
                        })()
                      )}
                    </div>

                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
                        Activity Timeline
                      </h4>
                      <div className="space-y-2">
                        {events
                          .filter((event) => event.suggestionId === suggestion.id)
                          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                          .map((event) => (
                            <div
                              key={event.id}
                              className="flex items-start gap-3 text-sm text-gray-300"
                            >
                              <span className="mt-1 h-2 w-2 rounded-full bg-primary-500"></span>
                              <div>
                                <p>
                                  <strong className="capitalize">{event.type}</strong>{' '}
                                  by {event.actor === 'community' ? 'Community' : event.actor}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {new Date(event.timestamp).toLocaleString()}
                                </p>
                                {event.metadata?.reason && (
                                  <p className="text-xs text-gray-400">
                                    Reason: {event.metadata.reason}
                                  </p>
                                )}
                                {event.metadata?.txHash && (
                                  <a
                                    href={`https://explorer.aptoslabs.com/txn/${event.metadata.txHash}?network=devnet`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-primary-300 hover:underline"
                                  >
                                    View transaction
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        {events.filter((event) => event.suggestionId === suggestion.id).length === 0 && (
                          <p className="text-sm text-gray-400">No activity recorded yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </PremiumContainer>
    </div>
  );
};

export default AdminSuggestionsPage;
