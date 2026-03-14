import React, { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import type { WalletName } from '@aptos-labs/wallet-adapter-react';
import { WalletReadyState } from '@aptos-labs/wallet-adapter-core';
import { FiX, FiCheckCircle, FiAlertCircle, FiExternalLink } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveWalletBrand, WALLET_BRAND_FALLBACK } from '../../config/walletBrands';

const FALLBACK_SOFT_COLOR = 'rgba(0, 212, 255, 0.12)';
const FALLBACK_ICON_BACKGROUND = 'rgba(0, 212, 255, 0.18)';
const FALLBACK_WEBSITE = 'https://aptos.dev/';

const hexToRgba = (hex: string, alpha: number): string | undefined => {
  if (!hex || typeof hex !== 'string') return undefined;
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) return undefined;

  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return undefined;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getBrandCssVariables = (brandColor: string): CSSProperties => ({
  '--wallet-brand': brandColor,
  '--wallet-brand-soft': hexToRgba(brandColor, 0.12) ?? FALLBACK_SOFT_COLOR,
} as CSSProperties);

const getIconWrapperStyle = (brandColor: string, hasIcon: boolean): CSSProperties => ({
  borderColor: brandColor,
  backgroundColor: hasIcon ? '#FFFFFF' : hexToRgba(brandColor, 0.15) ?? FALLBACK_ICON_BACKGROUND,
});

const inferWalletWebsite = (walletName: string): string => {
  const name = walletName.toLowerCase();
  if (name.includes('petra')) return 'https://petra.app/';
  if (name.includes('martian')) return 'https://martianwallet.xyz/';
  if (name.includes('pontem')) return 'https://pontem.network/';
  if (name.includes('fewcha')) return 'https://fewcha.app/';
  return FALLBACK_WEBSITE;
};

interface AptosWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AptosWalletModal: React.FC<AptosWalletModalProps> = ({ isOpen, onClose }) => {
  const { wallets, connect } = useWallet();

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleConnect = async (walletName: WalletName) => {
    try {
      await connect(walletName);
      onClose();
    } catch (error) {
      console.error('Failed to connect Aptos wallet:', error);
    }
  };

  // Group wallets by ready state
  const installedWallets = wallets.filter(w => w.readyState === WalletReadyState.Installed);
  const loadableWallets = wallets.filter(w => w.readyState === WalletReadyState.Loadable);
  const notDetectedWallets = wallets.filter(w => w.readyState === WalletReadyState.NotDetected);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, type: 'spring', damping: 25 }}
            className="relative z-10 w-full max-w-md mx-4 bg-[#0D1224] rounded-2xl border border-[#1C2537] shadow-[0_24px_64px_rgba(0,0,0,0.7)] overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aptos-wallet-modal-title"
          >
            {/* Header */}
            <div className="relative px-6 py-6 border-b border-white/[0.06]">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-xl border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
                aria-label="Close modal"
              >
                <FiX className="w-4 h-4 text-slate-400" />
              </button>

              <h2 id="aptos-wallet-modal-title" className="text-xl font-black text-white tracking-tight mb-1">
                Connect Wallet
              </h2>
              <p className="text-sm text-slate-500">
                Select your Aptos wallet to continue
              </p>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {/* Installed Wallets */}
              {installedWallets.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                    Available Wallets
                  </h3>
                  <div className="space-y-2">
                    {installedWallets.map((wallet) => {
                      const brand = resolveWalletBrand(wallet.name);
                      const brandColor = brand.brandColor ?? WALLET_BRAND_FALLBACK.brandColor;
                      const brandCssVariables = getBrandCssVariables(brandColor);
                      const iconWrapperStyle = getIconWrapperStyle(brandColor, Boolean(brand.icon));
                      const initials = brand.initials || wallet.name.trim().charAt(0).toUpperCase() || WALLET_BRAND_FALLBACK.initials;

                      return (
                        <button
                          key={wallet.name}
                          onClick={() => handleConnect(wallet.name)}
                          className="
                            w-full flex items-center justify-between p-4 rounded-xl border border-white/[0.07] bg-white/[0.03]
                            hover:border-[var(--wallet-brand)]
                            hover:bg-[var(--wallet-brand-soft)]
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--wallet-brand)]
                            transition-all group
                          "
                          style={brandCssVariables}
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-12 h-12 rounded-xl border flex items-center justify-center overflow-hidden bg-white shadow-sm transition-colors"
                              style={iconWrapperStyle}
                            >
                              {brand.icon ? (
                                <img
                                  src={brand.icon}
                                  alt={`${wallet.name} logo`}
                                  className="w-8 h-8 object-contain"
                                  loading="lazy"
                                />
                              ) : (
                                <span className="text-white text-lg font-semibold">
                                  {initials}
                                </span>
                              )}
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-white">
                                {wallet.name}
                              </div>
                              <div className="text-xs text-success-400 flex items-center space-x-1">
                                <FiCheckCircle className="w-3 h-3" />
                                <span>Installed</span>
                              </div>
                            </div>
                          </div>
                          <div
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: brandColor }}
                          >
                            →
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Loadable Wallets */}
              {loadableWallets.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                    Loadable Wallets
                  </h3>
                  <div className="space-y-2">
                    {loadableWallets.map((wallet) => {
                      const brand = resolveWalletBrand(wallet.name);
                      const brandColor = brand.brandColor ?? WALLET_BRAND_FALLBACK.brandColor;
                      const brandCssVariables = getBrandCssVariables(brandColor);
                      const iconWrapperStyle = getIconWrapperStyle(brandColor, Boolean(brand.icon));
                      const initials = brand.initials || wallet.name.trim().charAt(0).toUpperCase() || WALLET_BRAND_FALLBACK.initials;

                      return (
                        <button
                          key={wallet.name}
                          onClick={() => handleConnect(wallet.name)}
                          className="
                            w-full flex items-center justify-between p-4 rounded-xl border border-white/[0.07] bg-white/[0.03]
                            hover:border-[var(--wallet-brand)]
                            hover:bg-[var(--wallet-brand-soft)]
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--wallet-brand)]
                            transition-all group
                          "
                          style={brandCssVariables}
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-12 h-12 rounded-xl border flex items-center justify-center overflow-hidden bg-white shadow-sm transition-colors"
                              style={iconWrapperStyle}
                            >
                              {brand.icon ? (
                                <img
                                  src={brand.icon}
                                  alt={`${wallet.name} logo`}
                                  className="w-8 h-8 object-contain"
                                  loading="lazy"
                                />
                              ) : (
                                <span className="text-white text-lg font-semibold">
                                  {initials}
                                </span>
                              )}
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-white">
                                {wallet.name}
                              </div>
                              <div className="text-xs" style={{ color: brandColor }}>
                                Click to load
                              </div>
                            </div>
                          </div>
                          <div
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: brandColor }}
                          >
                            →
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Not Detected Wallets */}
              {notDetectedWallets.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                    Not Installed
                  </h3>
                  <div className="space-y-2">
                    {notDetectedWallets.map((wallet) => {
                      const brand = resolveWalletBrand(wallet.name);
                      const brandColor = brand.brandColor ?? WALLET_BRAND_FALLBACK.brandColor;
                      const brandCssVariables = getBrandCssVariables(brandColor);
                      const iconWrapperStyle = getIconWrapperStyle(brandColor, Boolean(brand.icon));
                      const initials = brand.initials || wallet.name.trim().charAt(0).toUpperCase() || WALLET_BRAND_FALLBACK.initials;
                      const website = brand.website ?? inferWalletWebsite(wallet.name);

                      return (
                        <a
                          key={wallet.name}
                          href={website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="
                            w-full flex items-center justify-between p-4 rounded-xl border border-white/[0.07] bg-white/[0.03]
                            hover:border-[var(--wallet-brand)]
                            hover:bg-[var(--wallet-brand-soft)]
                            transition-all group
                          "
                          style={brandCssVariables}
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-12 h-12 rounded-xl border flex items-center justify-center overflow-hidden bg-white shadow-sm transition-colors opacity-70 group-hover:opacity-100"
                              style={iconWrapperStyle}
                            >
                              {brand.icon ? (
                                <img
                                  src={brand.icon}
                                  alt={`${wallet.name} logo`}
                                  className="w-8 h-8 object-contain"
                                  loading="lazy"
                                />
                              ) : (
                                <span className="text-white text-lg font-semibold">
                                  {initials}
                                </span>
                              )}
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-white">
                                {wallet.name}
                              </div>
                              <div className="text-xs flex items-center space-x-1" style={{ color: brandColor }}>
                                <FiAlertCircle className="w-3 h-3" />
                                <span>Not detected</span>
                              </div>
                            </div>
                          </div>
                          <FiExternalLink
                            className="w-4 h-4 transition-colors"
                            style={{ color: brandColor }}
                          />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No Wallets Available */}
              {wallets.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">💼</div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    No Wallets Found
                  </h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Install an Aptos wallet to get started
                  </p>
                  <a
                    href="https://petra.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-primary-400 hover:underline"
                  >
                    <span>Download Petra Wallet</span>
                    <FiExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-white/[0.03] border-t border-white/[0.06]">
              <p className="text-xs text-center text-slate-400">
                New to Aptos wallets?{' '}
                <a
                  href="https://aptos.dev/guides/wallet-standard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:underline"
                >
                  Learn more
                </a>
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
