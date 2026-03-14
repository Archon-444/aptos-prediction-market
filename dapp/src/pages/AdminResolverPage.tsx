import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiRefreshCw, FiPlay, FiPause, FiSettings, FiClock, FiCheckCircle, FiXCircle, FiAlertCircle } from 'react-icons/fi';
import toast from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { useIsAdmin } from '../hooks/useRoles';
import { useChain } from '../contexts/ChainContext';
import { Container } from '../components/layout/Container';

interface ResolverConfig {
  intervalMs: number;
  enabled: boolean;
  dryRun: boolean;
}

interface PendingResolution {
  id: string;
  question: string;
  endDate: string;
  status: string;
  chain: string;
  canAutoResolve: boolean;
  resolutionReason: string;
  criteria?: any;
}

interface ResolverStatus {
  config: ResolverConfig;
  pendingResolutions: number;
  lastCheck: string;
}

const AdminResolverPage: React.FC = () => {
  const { activeChain } = useChain();
  const { hasRole: isAdmin, loading: adminLoading } = useIsAdmin();

  const [status, setStatus] = useState<ResolverStatus | null>(null);
  const [pendingResolutions, setPendingResolutions] = useState<PendingResolution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<ResolverConfig | null>(null);

  const canManage = isAdmin;

  // Load resolver status
  const loadStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/resolver/status', {
        headers: {
          'x-active-chain': activeChain,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load resolver status');
      }

      const data = await response.json();
      setStatus(data.data);
      setConfig(data.data.config);
    } catch (error: any) {
      console.error('[AdminResolverPage] Failed to load status:', error);
      toast.error(error?.message ?? 'Failed to load resolver status');
    } finally {
      setIsLoading(false);
    }
  };

  // Load pending resolutions
  const loadPendingResolutions = async () => {
    try {
      const response = await fetch('/api/resolver/pending', {
        headers: {
          'x-active-chain': activeChain,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load pending resolutions');
      }

      const data = await response.json();
      setPendingResolutions(data.data);
    } catch (error: any) {
      console.error('[AdminResolverPage] Failed to load pending resolutions:', error);
      toast.error(error?.message ?? 'Failed to load pending resolutions');
    }
  };

  // Run resolver manually
  const runResolver = async (dryRun: boolean = false) => {
    try {
      setIsRunning(true);
      const response = await fetch('/api/resolver/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-active-chain': activeChain,
        },
        body: JSON.stringify({ dryRun }),
      });

      if (!response.ok) {
        throw new Error('Failed to run resolver');
      }

      const data = await response.json();
      toast.success(`Resolver completed: ${data.data.count} markets processed`);

      // Refresh data
      await loadStatus();
      await loadPendingResolutions();
    } catch (error: any) {
      console.error('[AdminResolverPage] Failed to run resolver:', error);
      toast.error(error?.message ?? 'Failed to run resolver');
    } finally {
      setIsRunning(false);
    }
  };

  // Resolve specific market
  const resolveMarket = async (marketId: string, dryRun: boolean = false) => {
    try {
      const response = await fetch(`/api/resolver/resolve/${marketId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-active-chain': activeChain,
        },
        body: JSON.stringify({ dryRun }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? 'Failed to resolve market');
      }

      const data = await response.json();
      toast.success(`Market resolved: ${data.data.winningOutcome}`);

      // Refresh data
      await loadPendingResolutions();
    } catch (error: any) {
      console.error('[AdminResolverPage] Failed to resolve market:', error);
      toast.error(error?.message ?? 'Failed to resolve market');
    }
  };

  // Update resolver configuration
  const updateConfig = async () => {
    if (!config) return;

    try {
      const response = await fetch('/api/resolver/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-active-chain': activeChain,
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to update resolver config');
      }

      toast.success('Resolver configuration updated');
      await loadStatus();
    } catch (error: any) {
      console.error('[AdminResolverPage] Failed to update config:', error);
      toast.error(error?.message ?? 'Failed to update resolver config');
    }
  };

  // Load data on mount
  useEffect(() => {
    if (canManage) {
      loadStatus();
      loadPendingResolutions();
    }
  }, [canManage, activeChain]);

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-[#080B18] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-[#080B18] text-white selection:bg-primary-500/30">
        <Container size="sm">
          <div className="bg-error-900/20 border border-error-500/30 rounded-xl p-6 text-center">
            <h2 className="text-xl font-semibold text-error-200 mb-2">
              Admin Role Required
            </h2>
            <p className="text-error-100/80">
              Only DAO admins and resolvers can manage market resolution.
            </p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080B18] text-white selection:bg-primary-500/30">
      <Container size="xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">
              Market Resolver Controls
            </h1>
            <p className="text-slate-500 mt-2">
              Manage automated market resolution scheduling and manually trigger resolution checks.
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-500/20 px-3 py-2 text-sm text-primary-200 border border-primary-500/30">
              Managing resolver on <span className="font-semibold uppercase">{activeChain}</span>
            </p>
          </div>

          {/* Resolver Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Status</p>
                  <p className="text-2xl font-bold text-white">
                    {status?.config.enabled ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className={`w-3 h-3 rounded-full ${status?.config.enabled ? 'bg-success-500' : 'bg-error-500'}`}></div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Pending Resolutions</p>
                  <p className="text-2xl font-bold text-white">
                    {status?.pendingResolutions ?? 0}
                  </p>
                </div>
                <FiClock className="w-6 h-6 text-slate-500" />
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Check Interval</p>
                  <p className="text-2xl font-bold text-white">
                    {status?.config.intervalMs ? Math.round(status.config.intervalMs / 60000) : 0}m
                  </p>
                </div>
                <FiSettings className="w-6 h-6 text-slate-500" />
              </div>
            </div>
          </div>

          {/* Manual Controls */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-sm mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Manual Controls</h2>

            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => runResolver(false)}
                disabled={isRunning}
                className="flex items-center gap-2"
              >
                <FiPlay className="w-4 h-4" />
                {isRunning ? 'Running...' : 'Run Resolver'}
              </Button>

              <Button
                onClick={() => runResolver(true)}
                disabled={isRunning}
                variant="outline"
                className="flex items-center gap-2 border-white/20 text-white hover:bg-white/10"
              >
                <FiRefreshCw className="w-4 h-4" />
                Dry Run
              </Button>

              <Button
                onClick={() => {
                  loadStatus();
                  loadPendingResolutions();
                }}
                disabled={isLoading}
                variant="outline"
                className="flex items-center gap-2 border-white/20 text-white hover:bg-white/10"
              >
                <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Configuration */}
          {config && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-sm mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">Configuration</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Check Interval (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={Math.round(config.intervalMs / 60000)}
                    onChange={(e) => setConfig({
                      ...config,
                      intervalMs: parseInt(e.target.value) * 60000
                    })}
                    className="w-full px-3 py-2 border border-white/10 bg-white/5 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-white"
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => setConfig({
                        ...config,
                        enabled: e.target.checked
                      })}
                      className="w-4 h-4 text-primary-600 bg-[#0D1224] border-white/[0.1] rounded focus:ring-primary-500 focus:ring-2"
                    />
                    <span className="ml-2 text-sm text-slate-300">Enabled</span>
                  </label>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.dryRun}
                      onChange={(e) => setConfig({
                        ...config,
                        dryRun: e.target.checked
                      })}
                      className="w-4 h-4 text-primary-600 bg-[#0D1224] border-white/[0.1] rounded focus:ring-primary-500 focus:ring-2"
                    />
                    <span className="ml-2 text-sm text-slate-300">Dry Run Mode</span>
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <Button onClick={updateConfig} className="flex items-center gap-2">
                  <FiSettings className="w-4 h-4" />
                  Update Configuration
                </Button>
              </div>
            </div>
          )}

          {/* Pending Resolutions */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-white mb-4">Pending Resolutions</h2>

            {pendingResolutions.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                No markets pending resolution
              </p>
            ) : (
              <div className="space-y-4">
                {pendingResolutions.map((market) => (
                  <div
                    key={market.id}
                    className="flex items-center justify-between p-4 border border-white/10 bg-white/5 rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-white">{market.question}</h3>
                      <p className="text-sm text-slate-500">
                        Ends: {new Date(market.endDate).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {market.canAutoResolve ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-success-200 bg-success-500/20 rounded">
                            <FiCheckCircle className="w-3 h-3" />
                            Auto-resolvable
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-warning-200 bg-warning-500/20 rounded">
                            <FiAlertCircle className="w-3 h-3" />
                            Manual required
                          </span>
                        )}
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-200 bg-white/10 rounded">
                          {market.chain.toUpperCase()}
                        </span>
                      </div>
                      {!market.canAutoResolve && (
                        <p className="text-xs text-slate-500 mt-1">
                          {market.resolutionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => resolveMarket(market.id, false)}
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <FiPlay className="w-3 h-3" />
                        Resolve
                      </Button>
                      <Button
                        onClick={() => resolveMarket(market.id, true)}
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1 border-white/20 text-white hover:bg-white/10"
                      >
                        <FiRefreshCw className="w-3 h-3" />
                        Dry Run
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </Container>
    </div>
  );
};

export default AdminResolverPage;
