import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FiCheckCircle,
  FiDollarSign,
  FiTrendingUp,
  FiShield,
  FiClock,
  FiUsers,
  FiArrowRight,
  FiBarChart2,
  FiAward,
  FiCreditCard,
  FiCode,
} from 'react-icons/fi';
import { PremiumContainer } from '../components/layout/PremiumContainer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PayoutCalculator } from '../components/docs/PayoutCalculator';

export const HowItWorksPage: React.FC = () => {
  const steps = [
    {
      number: '01',
      icon: FiCreditCard,
      title: 'Connect Wallet',
      description:
        'Connect your wallet of choice to get started - Petra or Martian on Aptos, Suiet or Sui Wallet on Sui. No KYC required.',
      details: [
        'Install a compatible wallet extension for your selected chain (Petra or Martian on Aptos, Suiet or Sui Wallet on Sui)',
        'Click "Connect Wallet" in the top right',
        'Approve the connection request',
        'Your wallet address will be displayed',
      ],
    },
    {
      number: '02',
      icon: FiDollarSign,
      title: 'Get USDC',
      description:
        'Fund your wallet with USDC on your active chain. Move Market supports stablecoin wagers on both Aptos and Sui.',
      details: [
        'Bridge USDC to Aptos or Sui using LayerZero, Wormhole, or another supported bridge',
        'Use a DEX to swap APT or SUI into USDC depending on the chain',
        'Minimum bet size is typically 1 USDC',
        'Keep some APT or SUI for gas fees (both chains have very low costs)',
      ],
    },
    {
      number: '03',
      icon: FiBarChart2,
      title: 'Browse Markets',
      description:
        'Explore active prediction markets across categories like crypto, sports, politics, and technology.',
      details: [
        'Filter by category, end date, or volume',
        'View detailed market information and odds',
        'Check the resolution criteria',
        'Review trading volume and participant count',
      ],
    },
    {
      number: '04',
      icon: FiTrendingUp,
      title: 'Place Bet',
      description:
        'Choose your prediction (Yes or No), enter your bet amount, and confirm the transaction to place your bet.',
      details: [
        'Select Yes or No based on your prediction',
        'Enter the amount you want to bet',
        'Review the potential payout',
        'Confirm the transaction in your wallet',
      ],
    },
    {
      number: '05',
      icon: FiClock,
      title: 'Wait for Resolution',
      description:
        'After the market end date, an oracle or admin resolves the market based on real-world outcomes.',
      details: [
        'Markets close at the specified end date',
        'Trusted oracles verify the outcome',
        'Resolution is transparent and verifiable',
        'Disputed outcomes can be appealed',
      ],
    },
    {
      number: '06',
      icon: FiAward,
      title: 'Claim Winnings',
      description:
        'If your prediction was correct, claim your winnings directly to your wallet. Payouts are instant and automatic.',
      details: [
        'Winners are determined by market outcome',
        'Claim winnings from your dashboard',
        'Instant payout in USDC',
        'No withdrawal limits or delays',
      ],
    },
  ];

  const oddsCards = [
    {
      icon: FiBarChart2,
      title: 'Dynamic Odds',
      description:
        'Odds change based on the ratio of Yes and No bets. More popular outcomes have lower potential returns.',
    },
    {
      icon: FiUsers,
      title: 'Market-Driven',
      description:
        'Prices reflect the collective wisdom of all participants, creating accurate probability estimates.',
    },
    {
      icon: FiDollarSign,
      title: 'Fair Payouts',
      description:
        'Winners share the losing side pool proportionally to their bet size, minus a small platform fee.',
    },
  ];

  const benefits = [
    {
      icon: FiShield,
      title: 'Secure & Transparent',
      description:
        'All bets are stored on-chain across Aptos and Sui, ensuring complete transparency and immutability.',
    },
    {
      icon: FiDollarSign,
      title: 'Low Fees',
      description:
        'Aptos and Sui offer extremely low transaction fees, typically less than $0.01 per transaction.',
    },
    {
      icon: FiTrendingUp,
      title: 'Instant Settlement',
      description:
        'Fast block times mean your bets are confirmed in seconds, not minutes or hours.',
    },
    {
      icon: FiCheckCircle,
      title: 'No Custodial Risk',
      description:
        'Your funds remain in your wallet until you place a bet. Winners can withdraw immediately.',
    },
  ];

  const faqs = [
    {
      question: 'What is a prediction market?',
      answer:
        'A prediction market is a decentralized platform where users bet on the outcomes of future events. Prices reflect the collective probability assessment of participants.',
    },
    {
      question: 'How are markets resolved?',
      answer:
        'Markets are resolved by trusted oracles or admins who verify real-world outcomes. The resolution process is transparent and can be audited on-chain.',
    },
    {
      question: 'What happens if I bet on the losing side?',
      answer:
        'If you bet on the losing outcome, your stake is distributed among winners proportionally. You will lose your initial bet amount.',
    },
    {
      question: 'Can I sell my position before the market ends?',
      answer:
        'Currently, positions are locked until market resolution. Secondary market trading may be added in future updates.',
    },
    {
      question: 'What fees do you charge?',
      answer:
        'We charge a 2% platform fee on winning payouts. There are no fees to place bets, only standard Aptos or Sui gas fees (typically less than $0.01).',
    },
    {
      question: 'Is my money safe?',
      answer:
        'All funds are held in audited smart contracts on Aptos and Sui. The platform cannot access user funds, and all transactions are transparent on-chain.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#050713] text-white selection:bg-primary-500/30">
      <PremiumContainer size="xl">
        {/* Hero Section */}
        <section className="relative py-12 lg:py-16 text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="primary" className="mb-6 bg-primary-500/20 text-primary-200 border border-primary-500/30">
              Learn the Basics
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6 leading-tight">
              How It Works
            </h1>
            <p className="text-lg md:text-xl text-gray-400 leading-relaxed">
              Discover how to participate in decentralized prediction markets on Aptos and Sui.
              From connecting your wallet to claiming winnings, we will guide you through every step.
            </p>
          </motion.div>
        </section>

        {/* Steps Section */}
        <section className="mb-24">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              6 Simple Steps to Start
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Follow these steps to make your first prediction and start earning rewards
            </p>
          </div>

          <div className="space-y-8 lg:space-y-12">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="grid lg:grid-cols-2 gap-8 items-center">
                  {index % 2 === 0 ? (
                    <>
                      <div className="lg:pr-12">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="text-5xl font-display font-bold text-primary-500/40">
                            {step.number}
                          </div>
                          <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center border border-primary-500/30">
                            <step.icon className="w-6 h-6 text-primary-400" />
                          </div>
                        </div>
                        <h3 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
                          {step.title}
                        </h3>
                        <p className="text-lg text-gray-400 mb-6">{step.description}</p>
                        <ul className="space-y-3">
                          {step.details.map((detail, detailIndex) => (
                            <li key={detailIndex} className="flex items-start gap-3">
                              <FiCheckCircle className="w-5 h-5 text-success-400 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-300">{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 lg:p-12 flex items-center justify-center">
                        <step.icon className="w-32 h-32 text-primary-500/40" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 lg:p-12 flex items-center justify-center lg:order-first">
                        <step.icon className="w-32 h-32 text-primary-500/40" />
                      </div>
                      <div className="lg:pl-12">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="text-5xl font-display font-bold text-primary-500/40">
                            {step.number}
                          </div>
                          <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center border border-primary-500/30">
                            <step.icon className="w-6 h-6 text-primary-400" />
                          </div>
                        </div>
                        <h3 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
                          {step.title}
                        </h3>
                        <p className="text-lg text-gray-400 mb-6">{step.description}</p>
                        <ul className="space-y-3">
                          {step.details.map((detail, detailIndex) => (
                            <li key={detailIndex} className="flex items-start gap-3">
                              <FiCheckCircle className="w-5 h-5 text-success-400 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-300">{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How Odds Work Section */}
        <section className="mb-24">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Understanding Odds
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Learn how prediction market odds work and how payouts are calculated
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {oddsCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card hover padding="lg" className="bg-white/5 border-white/10 h-full">
                  <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center mb-4 border border-primary-500/30">
                    <card.icon className="w-6 h-6 text-primary-400" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-white mb-2">
                    {card.title}
                  </h3>
                  <p className="text-gray-400">{card.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Interactive Calculator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto"
          >
            <PayoutCalculator />
          </motion.div>
        </section>

        {/* Benefits Section */}
        <section className="mb-24">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Why Choose Our Platform
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Built on Aptos and Sui for the best prediction market experience
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card hover padding="lg" className="bg-white/5 border-white/10 h-full">
                  <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center mb-4 border border-primary-500/30">
                    <benefit.icon className="w-6 h-6 text-primary-400" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-white mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-400">{benefit.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-24">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Got questions? We have got answers
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card padding="lg" className="bg-white/5 border-white/10">
                  <h3 className="text-lg font-display font-bold text-white mb-2">
                    {faq.question}
                  </h3>
                  <p className="text-gray-400">{faq.answer}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center max-w-3xl mx-auto pb-12">
          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-12 border border-primary-500/30 shadow-2xl shadow-primary-900/50">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-6">
              Ready to Make Your First Prediction?
            </h2>
            <p className="text-lg text-primary-100 mb-8">
              Join thousands of users predicting on real-world events and earning rewards
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/markets">
                <Button
                  variant="secondary"
                  size="lg"
                  rightIcon={<FiArrowRight />}
                  className="bg-white text-primary-900 hover:bg-gray-100"
                >
                  Browse Markets
                </Button>
              </Link>
              <Link to="/docs/developer">
                <Button
                  variant="outline"
                  size="lg"
                  className="bg-primary-900/50 border-white/20 text-white hover:bg-primary-900/70"
                  leftIcon={<FiCode />}
                >
                  Developer Docs
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
                <span>2% Platform Fee</span>
              </div>
              <div className="flex items-center gap-2">
                <FiCheckCircle className="w-5 h-5" />
                <span>Instant Payouts</span>
              </div>
              <div className="flex items-center gap-2">
                <FiCheckCircle className="w-5 h-5" />
                <span>100% On-Chain</span>
              </div>
            </div>
          </div>
        </section>
      </PremiumContainer>
    </div>
  );
};

export default HowItWorksPage;
