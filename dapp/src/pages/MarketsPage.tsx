import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FiTrendingUp, FiClock } from 'react-icons/fi';
import { Container } from '../components/layout/Container';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useDebounce } from '../hooks/useDebounce';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefresh } from '../components/mobile/PullToRefresh';
import CategoryFilter from '../components/CategoryFilter';
import AdvancedFilters, { SortOption, StatusFilter } from '../components/AdvancedFilters';
import { MarketCategory, getCategoryFromQuestion, getCategoryInfo } from '../types/categories';
import { useMarkets } from '../hooks/useMarkets';
import { fromMicroUSDC } from '../utils/validation';
import { sanitizeMarketQuestion } from '../utils/sanitize';
import { useChain } from '../contexts/ChainContext';

interface DisplayMarket {
  id: number;
  question: string;
  category: MarketCategory;
  totalStakes: number;
  endTime: number;
  resolved: boolean;
  status: 'active' | 'ending_soon' | 'closed';
}

const formatStake = (micro: number): string =>
  `$${fromMicroUSDC(micro).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const formatEndsIn = (endTime: number, resolved: boolean): string => {
  if (resolved) {
    return 'Resolved';
  }
  const end = endTime * 1000;
  const diff = end - Date.now();
  if (diff <= 0) {
    return 'Closing soon';
  }
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  const seconds = Math.floor((diff % (60 * 1000)) / 1000);
  return `${minutes}m ${seconds}s`;
};

export const MarketsPage: React.FC = () => {
  const { activeChain } = useChain();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory>(MarketCategory.ALL);
  const [sortBy, setSortBy] = useState<SortOption>(SortOption.HIGHEST_VOLUME);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(StatusFilter.ALL);
  const { markets, isLoading, error, refetch } = useMarkets();

  const debouncedSearch = useDebounce(searchQuery, 300);

  const handleRefresh = async () => {
    await refetch();
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: true,
  });

  const displayMarkets: DisplayMarket[] = useMemo(() => {
    return markets.map((market) => {
      const category = getCategoryFromQuestion(market.question);
      const endMillis = market.endTime * 1000;
      const diff = endMillis - Date.now();
      let status: DisplayMarket['status'] = 'active';
      if (market.resolved) {
        status = 'closed';
      } else if (diff <= 0 || diff < 3 * 24 * 60 * 60 * 1000) {
        status = 'ending_soon';
      }

      return {
        id: market.id,
        question: sanitizeMarketQuestion(market.question),
        category,
        totalStakes: market.totalStakes,
        endTime: market.endTime,
        resolved: market.resolved,
        status,
      };
    });
  }, [markets]);

  const filteredMarkets = useMemo(() => {
    const matchesSearch = (market: DisplayMarket) =>
      market.question.toLowerCase().includes(debouncedSearch.toLowerCase());

    const matchesCategory = (market: DisplayMarket) =>
      selectedCategory === MarketCategory.ALL || market.category === selectedCategory;

    const matchesStatus = (market: DisplayMarket) => {
      if (statusFilter === StatusFilter.ACTIVE) {
        return market.status === 'active';
      }
      if (statusFilter === StatusFilter.RESOLVED) {
        return market.status === 'closed';
      }
      if (statusFilter === StatusFilter.ENDING_SOON) {
        return market.status === 'ending_soon';
      }
      return true;
    };

    const filtered = displayMarkets.filter(
      (market) => matchesSearch(market) && matchesCategory(market) && matchesStatus(market)
    );

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case SortOption.NEWEST:
          return b.id - a.id;
        case SortOption.ENDING_SOON:
          return a.endTime - b.endTime;
        case SortOption.HIGHEST_VOLUME:
        case SortOption.MOST_POPULAR:
          return b.totalStakes - a.totalStakes;
        default:
          return 0;
      }
    });

    return sorted;
  }, [displayMarkets, debouncedSearch, selectedCategory, statusFilter, sortBy]);

  const categoryCounts = useMemo(() => {
    const counts: Record<MarketCategory, number> = {
      [MarketCategory.ALL]: displayMarkets.length,
      [MarketCategory.CRYPTO]: 0,
      [MarketCategory.SPORTS]: 0,
      [MarketCategory.POLITICS]: 0,
      [MarketCategory.ENTERTAINMENT]: 0,
      [MarketCategory.TECHNOLOGY]: 0,
      [MarketCategory.SCIENCE]: 0,
      [MarketCategory.BUSINESS]: 0,
      [MarketCategory.WEATHER]: 0,
      [MarketCategory.OTHER]: 0,
    };

    displayMarkets.forEach((market) => {
      counts[market.category]++;
    });

    return counts;
  }, [displayMarkets]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <PullToRefresh isRefreshing={isRefreshing} pullDistance={pullDistance} />
      <Container className="py-12 space-y-8">
        <div className="flex flex-col gap-3">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-primary-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
            {activeChain === 'aptos' ? 'Aptos' : 'Sui'} markets
          </span>
          {activeChain === 'sui' && (
            <p className="max-w-2xl text-sm text-sky-800 dark:text-sky-100 bg-sky-100/70 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-700 rounded-lg px-4 py-3">
              Sui markets load directly from the on-chain market objects. Post-resolution updates rely on the new oracle aggregate snapshot, so settlements may take a few seconds to surface while the indexer polls fresh events.
            </p>
          )}
        </div>
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900 dark:text-white transition-colors">
            Prediction Markets
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 transition-colors">
            Browse and participate in live markets powered by on-chain data.
          </p>
        </div>

        <CategoryFilter
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          marketCounts={categoryCounts}
        />

        <AdvancedFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          totalResults={filteredMarkets.length}
        />

        <div className="grid md:grid-cols-3 gap-6">
          <Card hover>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary-100 rounded-xl">
                <FiTrendingUp className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Activity</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Markets update in real-time with Pyth prices and optimistic consensus.
                </p>
              </div>
            </div>
          </Card>
          <Card hover>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-success-100 rounded-xl">
                <FiClock className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ending Soon</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Keep an eye on markets approaching resolution windows.
                </p>
              </div>
            </div>
          </Card>
          <Card hover>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-warning-100 rounded-xl">
                <FiTrendingUp className="w-6 h-6 text-warning-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Trending Topics</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Discover high-volume markets across crypto, sports, tech, and more.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {error && (
          <div className="rounded-lg border border-error-200 bg-error-50 text-error-700 p-4">
            {error.message}
          </div>
        )}

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Card key={idx} className="h-64 animate-pulse">
                <div className="text-gray-400">Loading...</div>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMarkets.map((market, index) => {
                const categoryInfo = getCategoryInfo(market.category);
                return (
                  <motion.div
                    key={market.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.04 }}
                  >
                    <Card hover padding="lg">
                      <div className="flex items-start justify-between mb-4">
                        <Badge
                          variant="secondary"
                          title={categoryInfo.description}
                        >
                          <span className="mr-1">{categoryInfo.icon}</span>
                          {categoryInfo.label}
                        </Badge>
                        <Badge variant={market.status === 'closed' ? 'neutral' : market.status === 'ending_soon' ? 'warning' : 'success'}>
                          {market.status.replace('_', ' ')}
                        </Badge>
                      </div>

                      <h3 className="text-lg font-display font-semibold text-gray-900 dark:text-white mb-4 transition-colors line-clamp-2">
                        {market.question}
                      </h3>

                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                          <span>Total Stakes</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {formatStake(market.totalStakes)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                          <span>Ends In</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {formatEndsIn(market.endTime, market.resolved)}
                          </span>
                        </div>
                      </div>

                      <Button to={`/market/${market.id}`} variant="primary" className="w-full mt-6">
                        View Market
                      </Button>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {filteredMarkets.length === 0 && (
              <div className="text-center py-16">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  No markets found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Adjust filters or search terms to discover more opportunities.
                </p>
              </div>
            )}
          </>
        )}
      </Container>
    </div>
  );
};

export default MarketsPage;
