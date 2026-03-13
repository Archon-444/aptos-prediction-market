import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWalletFacade } from '../components/WalletFacade';
import { motion } from 'framer-motion';
import { FiTrendingUp, FiArrowRight } from 'react-icons/fi';
import { Container } from '../components/layout/Container';
import { Button } from '../components/ui/Button';
import { useChain } from '../contexts/ChainContext';
import { APTOS_TRENDING_MARKETS, SUI_TRENDING_MARKETS } from '../data/mockMarkets';
import { FeaturedMarketCard } from '../components/FeaturedMarketCard';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { loadWallet } = useWalletFacade();
  const { activeChain } = useChain();
  const [isStarting, setIsStarting] = useState(false);

  const handleStartApp = async () => {
    setIsStarting(true);
    loadWallet();
    await new Promise(resolve => setTimeout(resolve, 300));
    navigate('/markets');
  };

  const trendingMarkets = activeChain === 'sui' ? SUI_TRENDING_MARKETS : APTOS_TRENDING_MARKETS;

  return (
    <div className="min-h-screen bg-[#050713] text-white selection:bg-primary-500/30">
      <Container className="py-12 lg:py-20">
        {/* Main Content Area - Mimicking the dark container in screenshot */}
        <div className="bg-[#0A0E27] rounded-[40px] p-8 md:p-12 lg:p-16 relative overflow-hidden border border-white/5 shadow-2xl">

          {/* Background Glows */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary-500/10 rounded-full blur-[100px] pointer-events-none" />

          {/* Header Section */}
          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-end mb-16 gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                <span className="text-sm font-medium tracking-wide text-gray-300 uppercase">
                  Featured Markets
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight mb-6">
                Prediction rails powering <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-secondary-400">
                  {activeChain === 'sui' ? 'Sui Network' : 'Aptos Network'}
                </span>
              </h1>

              <p className="text-lg text-gray-400 max-w-xl leading-relaxed">
                Here are a few of the high-volume markets operating today.
                Trade with instant settlement and deep liquidity on Move.
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                variant="primary"
                size="lg"
                rightIcon={<FiTrendingUp />}
                onClick={handleStartApp}
                loading={isStarting}
                className="rounded-full px-8"
              >
                {isStarting ? 'Launching...' : 'Launch App'}
              </Button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="relative z-10 grid md:grid-cols-2 gap-x-8 gap-y-12">
            {trendingMarkets.map((market, index) => (
              <FeaturedMarketCard
                key={market.id}
                index={index}
                title={market.question}
                category={market.category}
                volume={market.volume}
                odds={market.odds}
                endsIn={market.endsIn}
                onClick={() => navigate(`/market/${market.id}`)}
              />
            ))}
          </div>

          {/* Footer Link */}
          <div className="relative z-10 mt-16 flex justify-center">
            <Link
              to="/markets"
              className="group inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <span className="font-medium">View all markets</span>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <FiArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>

        </div>
      </Container>
    </div>
  );
};

export default LandingPage;
