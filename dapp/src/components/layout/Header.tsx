import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX, FiTrendingUp, FiDollarSign, FiAlertCircle, FiZap, FiBell } from 'react-icons/fi';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useSuiWallet } from '../../contexts/SuiWalletContext';
import { useChain } from '../../contexts/ChainContext';
import { Container } from './Container';
import { Button } from '../ui/Button';
import { ChainSwitcher } from '../ChainSwitcher';
import { ChainAwareWalletModal } from '../wallet/ChainAwareWalletModal';
import { useUSDCBalance } from '../../hooks/useUSDC';
import { useUSDCFaucet } from '../../hooks/useTransactions';
import { useChainCurrency } from '../../hooks/useChainCurrency';
import useWusdcWarning from '../../hooks/useWusdcWarning';
import { useIsAdmin } from '../../hooks/useRoles';
import { useMarkets } from '../../hooks/useMarkets';
import { useUserPositions } from '../../hooks/useUserPosition';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationPanel } from './NotificationPanel';

const NAV_ITEMS = [
  { label: 'Markets', href: '/markets' },
  { label: 'Leaderboard', href: '/leaderboard' },
  { label: 'Oracle', href: '/oracle' },
  { label: 'My Bets', href: '/dashboard' },
  { label: 'Liquidity', href: '/liquidity' },
  { label: 'DAO', href: '/dao' },
  { label: 'How It Works', href: '/how-it-works' },
];

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { activeChain } = useChain();
  const location = useLocation();
  const navigate = useNavigate();

  const { account: aptosAccount, disconnect: aptosDisconnect, connected: aptosConnected, wallet: aptosWallet } = useWallet();
  const { account: suiAccount, disconnect: suiDisconnect, connected: suiConnected } = useSuiWallet();

  const account = activeChain === 'aptos' ? aptosAccount : suiAccount;
  const connected = activeChain === 'aptos' ? aptosConnected : suiConnected;

  const { formatted, isLoading: balanceLoading } = useUSDCBalance();
  const { claimFromFaucet, isLoading: faucetLoading, faucetAvailable } = useUSDCFaucet();
  const currency = useChainCurrency();
  const wusdcWarning = useWusdcWarning();
  const { hasRole: isAdmin } = useIsAdmin();
  const { markets } = useMarkets();
  const address = account ? String(account.address) : undefined;
  const { positions } = useUserPositions(address, markets.length);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(markets, positions);

  const adminItems = isAdmin
    ? [
        { label: 'Admin Roles', href: '/admin/roles' },
        { label: 'Resolver', href: '/admin/resolver' },
      ]
    : [];

  const allNavItems = [...NAV_ITEMS, ...adminItems];

  // Auto-disconnect when chain switches
  useEffect(() => {
    const handle = async () => {
      try {
        if (aptosConnected && activeChain === 'sui') await aptosDisconnect();
        if (suiConnected && activeChain === 'aptos') suiDisconnect();
      } catch {}
    };
    handle();
  }, [activeChain, aptosConnected, suiConnected, aptosDisconnect, suiDisconnect]);

  useEffect(() => {
    if (connected) setWalletModalOpen(false);
  }, [connected]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  const handleDisconnect = useCallback(async () => {
    try {
      if (activeChain === 'aptos' && aptosConnected) await aptosDisconnect();
      else if (activeChain === 'sui' && suiConnected) suiDisconnect();
    } catch {}
  }, [activeChain, aptosConnected, suiConnected, aptosDisconnect, suiDisconnect]);

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  const renderWalletButton = (context: 'desktop' | 'mobile' = 'desktop') => {
    if (connected) {
      return (
        <button
          onClick={() => setWalletModalOpen(true)}
          className={`group inline-flex items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.05] px-3.5 py-2 transition-all hover:bg-white/[0.08] hover:border-white/[0.16] focus:outline-none ${
            context === 'mobile' ? 'w-full justify-between' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex flex-col text-left leading-tight">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                {currency.unitLabel}
              </span>
              <span className="text-sm font-bold text-white">
                {balanceLoading ? '…' : formatted}
              </span>
            </div>
            {account?.address && (
              <span className="rounded-lg bg-white/[0.05] px-2 py-1 text-[11px] font-mono text-slate-400 border border-white/[0.07]">
                {String(account.address).slice(0, 6)}…{String(account.address).slice(-4)}
              </span>
            )}
          </div>
          <span className="hidden md:inline text-[11px] font-semibold text-primary-400 group-hover:text-primary-300 transition-colors">
            Manage
          </span>
        </button>
      );
    }

    return (
      <Button
        variant="primary"
        size={context === 'mobile' ? 'sm' : 'md'}
        onClick={() => setWalletModalOpen(true)}
        className={`rounded-xl ${context === 'mobile' ? 'w-full' : ''}`}
      >
        Connect Wallet
      </Button>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-[#080B18]/85 backdrop-blur-xl">
        <Container>
          <div className="flex flex-col gap-0">
            {/* wUSDC warning */}
            {wusdcWarning.shouldShow && (
              <div className="flex items-start gap-3 rounded-xl border border-warning-500/25 bg-warning-500/[0.07] px-4 py-3 my-3 text-sm text-warning-200">
                <FiAlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-400" />
                <div>
                  <p className="font-semibold">Bridged wUSDC detected. Native Circle USDC is required on Sui.</p>
                  <p className="opacity-75 text-xs mt-0.5">
                    You hold ~{wusdcWarning.balanceFormatted} wUSDC.{' '}
                    <a href={wusdcWarning.migrationUrl} target="_blank" rel="noreferrer" className="underline hover:text-warning-100">
                      View migration guide
                    </a>
                  </p>
                </div>
              </div>
            )}

            {/* Top bar: logo + wallet + hamburger */}
            <div className="flex items-center justify-between h-14">
              {/* Logo */}
              <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center shadow-[0_0_16px_rgba(59,130,246,0.35)] group-hover:shadow-[0_0_24px_rgba(59,130,246,0.5)] transition-all group-hover:-translate-y-0.5">
                  <FiTrendingUp className="w-5 h-5 text-white" />
                </div>
                <div className="hidden sm:block">
                  <span className="text-lg font-black text-white tracking-tight">Prophecy</span>
                  <span className="block text-[9px] uppercase font-bold tracking-[0.15em] text-primary-400">
                    Prediction Protocol
                  </span>
                </div>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-1">
                {allNavItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                      isActive(item.href)
                        ? 'text-white bg-white/[0.07]'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Right: chain + wallet + actions */}
              <div className="flex items-center gap-2">
                <ChainSwitcher />

                {/* Notification bell */}
                {connected && (
                  <div className="relative">
                    <button
                      onClick={() => setNotifOpen((v) => !v)}
                      className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-colors focus:outline-none"
                      aria-label="Notifications"
                    >
                      <FiBell className="w-4.5 h-4.5 text-slate-400" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary-500 text-[10px] font-bold text-white px-1 border-2 border-[#080B18]">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>
                    <NotificationPanel
                      isOpen={notifOpen}
                      onClose={() => setNotifOpen(false)}
                      notifications={notifications}
                      unreadCount={unreadCount}
                      onMarkRead={markRead}
                      onMarkAllRead={markAllRead}
                    />
                  </div>
                )}

                {/* Faucet (desktop) */}
                {faucetAvailable && connected && (
                  <button
                    onClick={claimFromFaucet}
                    disabled={faucetLoading}
                    className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-warning-400 border border-warning-500/30 bg-warning-500/[0.07] px-3 py-2 rounded-xl hover:bg-warning-500/10 transition-all disabled:opacity-50"
                  >
                    <FiZap className="w-3.5 h-3.5" />
                    {faucetLoading ? 'Claiming…' : 'Faucet'}
                  </button>
                )}

                {/* Create Market (desktop) */}
                <Button
                  variant="primary"
                  size="sm"
                  to="/create"
                  className="hidden md:inline-flex rounded-xl border-0 !bg-gradient-to-r from-primary-500 to-secondary-600 shadow-[0_0_16px_rgba(59,130,246,0.25)] hover:shadow-[0_0_24px_rgba(59,130,246,0.4)] text-xs font-bold"
                >
                  + Create
                </Button>

                <div className="hidden md:flex items-center gap-2">
                  {connected && (
                    <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-xs text-slate-500 hover:text-slate-300">
                      Disconnect
                    </Button>
                  )}
                  {renderWalletButton('desktop')}
                </div>

                {/* Mobile hamburger */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-colors focus:outline-none"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <FiX className="w-5 h-5 text-white" /> : <FiMenu className="w-5 h-5 text-white" />}
                </button>
              </div>
            </div>
          </div>
        </Container>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-white/[0.05] bg-[#080B18] overflow-hidden"
            >
              <Container>
                <div className="py-4 space-y-3">
                  <div className="flex flex-col gap-2">
                    {renderWalletButton('mobile')}
                    {connected && (
                      <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-sm text-slate-400 border border-white/[0.07]">
                        Disconnect
                      </Button>
                    )}
                    {faucetAvailable && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={claimFromFaucet}
                        loading={faucetLoading}
                        leftIcon={currency.chain === 'sui' ? <span className="font-bold">◊</span> : <FiDollarSign />}
                        className="border-warning-500/30 text-warning-400 hover:bg-warning-500/[0.08]"
                      >
                        {currency.chain === 'sui' ? 'SUI Faucet' : 'Claim Testnet Funds'}
                      </Button>
                    )}
                  </div>

                  <nav className="space-y-1">
                    {allNavItems.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                          isActive(item.href)
                            ? 'bg-white/[0.07] text-white'
                            : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>

                  <div className="grid gap-2 pt-1">
                    <Button variant="primary" size="md" onClick={() => { setMobileMenuOpen(false); navigate('/create'); }} className="rounded-xl border-0 !bg-gradient-to-r from-primary-500 to-secondary-600">
                      + Create Market
                    </Button>
                  </div>
                </div>
              </Container>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <ChainAwareWalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </>
  );
};

export default Header;
