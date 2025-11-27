import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiRefreshCw, FiPlay, FiPause, FiSettings, FiClock, FiCheckCircle, FiXCircle, FiAlertCircle } from 'react-icons/fi';
import toast from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { useIsAdmin } from '../hooks/useRoles';
import { useChain } from '../contexts/ChainContext';

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
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-6 text-center">
          <h2 className="text-xl font-semibold text-red-900 dark:text-red-200 mb-2">
            Admin Role Required
          </h2>
          <p className="text-red-800 dark:text-red-300">
            Only DAO admins and resolvers can manage market resolution.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="container mx-auto px-4 py-10 max-w-6xl"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Market Resolver Controls
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage automated market resolution scheduling and manually trigger resolution checks.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 dark:bg-primary-900/20 dark:text-primary-200">
          Managing resolver on <span className="font-semibold uppercase">{activeChain}</span>
        </p>
      </div>

      {/* Resolver Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {status?.config.enabled ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className={`w-3 h-3 rounded-full ${status?.config.enabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Resolutions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {status?.pendingResolutions ?? 0}
              </p>
            </div>
            <FiClock className="w-6 h-6 text-gray-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Check Interval</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {status?.config.intervalMs ? Math.round(status.config.intervalMs / 60000) : 0}m
              </p>
            </div>
            <FiSettings className="w-6 h-6 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Manual Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Manual Controls</h2>
        
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
            className="flex items-center gap-2"
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
            className="flex items-center gap-2"
          >
            <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Configuration */}
      {config && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Enabled</span>
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
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Dry Run Mode</span>
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
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Pending Resolutions</h2>
        
        {pendingResolutions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No markets pending resolution
          </p>
        ) : (
          <div className="space-y-4">
            {pendingResolutions.map((market) => (
              <div
                key={market.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-white">{market.question}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ends: {new Date(market.endDate).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {market.canAutoResolve ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-800 bg-green-100 dark:bg-green-900/20 dark:text-green-200 rounded">
                        <FiCheckCircle className="w-3 h-3" />
                        Auto-resolvable
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-200 rounded">
                        <FiAlertCircle className="w-3 h-3" />
                        Manual required
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-800 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded">
                      {market.chain.toUpperCase()}
                    </span>
                  </div>
                  {!market.canAutoResolve && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                    className="flex items-center gap-1"
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
  );
};

export default AdminResolverPage;
