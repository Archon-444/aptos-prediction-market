import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWalletFacade } from '../components/WalletFacade';
import { motion } from 'framer-motion';
import { FiTrendingUp, FiShield, FiZap, FiUsers, FiDollarSign, FiCheckCircle } from 'react-icons/fi';
import { Container } from '../components/layout/Container';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { loadWallet, isWalletLoaded } = useWalletFacade();
  const [isStarting, setIsStarting] = useState(false);

  const handleStartApp = async () => {
    setIsStarting(true);
    // Pre-load wallet SDK
    loadWallet();
    // Wait a moment for SDK to start loading
    await new Promise(resolve => setTimeout(resolve, 300));
    // Navigate to markets page
    navigate('/markets');
  };
  const features = [
    {
      icon: FiShield,
      title: 'Secure & Transparent',
      description: 'All predictions secured on Aptos and Sui with full transparency',
    },
    {
      icon: FiZap,
      title: 'Instant Settlement',
      description: 'Fast payouts powered by Aptos and Sui high-performance blockchains',
    },
    {
      icon: FiDollarSign,
      title: 'Low Fees',
      description: 'Minimal transaction costs with USDC stablecoin betting',
    },
    {
      icon: FiUsers,
      title: 'Community Driven',
      description: 'Create and participate in markets that matter to you',
    },
  ];

  const stats = [
    { label: 'Total Volume', value: '$2.5M+' },
    { label: 'Active Markets', value: '150+' },
    { label: 'Predictions Made', value: '10K+' },
    { label: 'Users', value: '5K+' },
  ];

  const trendingMarkets = [
    {
      id: 1,
      question: 'Will Bitcoin reach $100k by end of 2025?',
      category: 'Crypto',
      volume: '$45,200',
      odds: { yes: 65, no: 35 },
      endsIn: '15 days',
    },
    {
      id: 2,
      question: 'Will Aptos process 1M+ TPS in 2025?',
      category: 'Technology',
      volume: '$32,100',
      odds: { yes: 72, no: 28 },
      endsIn: '22 days',
    },
    {
      id: 3,
      question: 'Will AI replace 50% of coding jobs by 2030?',
      category: 'Technology',
      volume: '$28,900',
      odds: { yes: 48, no: 52 },
      endsIn: '8 days',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-16 lg:py-24 overflow-hidden transition-colors">
        <Container>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="primary" className="mb-6">
                Powered by Move (Aptos & Sui)
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-gray-900 dark:text-white mb-6 leading-tight transition-colors">
                Predict the Future,
                <span className="text-primary-500"> Earn Rewards</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed transition-colors">
                Join the decentralized prediction market on Aptos and Sui. Bet on real-world events,
                sports, crypto, and more with complete transparency and instant payouts.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<FiTrendingUp />}
                  onClick={handleStartApp}
                  loading={isStarting}
                >
                  {isStarting ? 'Launching App...' : 'Start App'}
                </Button>
                <Link to="/how-it-works">
                  <Button variant="outline" size="lg">
                    Learn More
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
                {stats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                  >
                    <div className="text-2xl md:text-3xl font-display font-bold text-primary-500">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 transition-colors">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right Column - Visual */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-primary-600 rounded-3xl blur-3xl opacity-20" />
                <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-gray-700 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-bold text-gray-900 dark:text-white transition-colors">
                      Live Prediction
                    </h3>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mb-6 transition-colors">
                    Will Bitcoin reach $100k by end of 2025?
                  </p>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">Yes - 65%</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 transition-colors">$29,250</span>
                      </div>
                      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden transition-colors">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: '65%' }}
                          transition={{ duration: 1, delay: 0.5 }}
                          className="h-full bg-success-500 rounded-full"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">No - 35%</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 transition-colors">$15,950</span>
                      </div>
                      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden transition-colors">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: '35%' }}
                          transition={{ duration: 1, delay: 0.7 }}
                          className="h-full bg-error-500 rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 transition-colors">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400 transition-colors">Total Volume</span>
                      <span className="font-semibold text-gray-900 dark:text-white transition-colors">$45,200</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Features Section */}
      <section className="py-16 lg:py-24 bg-white dark:bg-gray-900 transition-colors">
        <Container>
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900 dark:text-white mb-4 transition-colors">
              Why Choose Move Market?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto transition-colors">
              Experience the future of prediction markets with cutting-edge blockchain technology
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card hover padding="lg">
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-xl flex items-center justify-center mb-4 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary-500" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-gray-900 dark:text-white mb-2 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 transition-colors">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* Trending Markets Section */}
      <section className="py-16 lg:py-24 bg-gray-50 dark:bg-gray-800 transition-colors">
        <Container>
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900 dark:text-white mb-4 transition-colors">
                Trending Markets
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 transition-colors">
                Join thousands predicting on hot topics
              </p>
            </div>
            <Link to="/markets" className="hidden sm:block">
              <Button variant="outline">View All Markets</Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingMarkets.map((market, index) => (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card hover padding="lg" onClick={() => {}}>
                  <div className="flex items-start justify-between mb-4">
                    <Badge variant="primary">{market.category}</Badge>
                    <span className="text-sm text-gray-500 dark:text-gray-400 transition-colors">{market.endsIn}</span>
                  </div>
                  <h3 className="text-lg font-display font-semibold text-gray-900 dark:text-white mb-4 line-clamp-2 transition-colors">
                    {market.question}
                  </h3>
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400 transition-colors">Yes</span>
                      <span className="text-sm font-semibold text-success-500">
                        {market.odds.yes}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400 transition-colors">No</span>
                      <span className="text-sm font-semibold text-error-500">
                        {market.odds.no}%
                      </span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-700 transition-colors">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400 transition-colors">Volume</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white transition-colors">
                        {market.volume}
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link to="/markets">
              <Button variant="outline" fullWidth>
                View All Markets
              </Button>
            </Link>
          </div>
        </Container>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24 bg-gradient-to-br from-primary-500 to-primary-600">
        <Container>
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-6">
              Ready to Start Predicting?
            </h2>
            <p className="text-lg text-primary-100 mb-8">
              Connect your wallet and join thousands of users earning rewards on Move Market
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="secondary"
                size="lg"
                rightIcon={<FiTrendingUp />}
                onClick={handleStartApp}
                loading={isStarting}
              >
                {isStarting ? 'Launching App...' : 'Start App Now'}
              </Button>
              <Link to="/how-it-works">
                <Button variant="outline" size="lg" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  Learn How It Works
                </Button>
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap justify-center gap-6 text-primary-100">
              <div className="flex items-center gap-2">
                <FiCheckCircle className="w-5 h-5" />
                <span>No KYC Required</span>
              </div>
              <div className="flex items-center gap-2">
                <FiCheckCircle className="w-5 h-5" />
                <span>Instant Payouts</span>
              </div>
              <div className="flex items-center gap-2">
                <FiCheckCircle className="w-5 h-5" />
                <span>100% Transparent</span>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
};

export default LandingPage;
