import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FiChevronDown,
  FiChevronUp,
  FiHelpCircle,
  FiShield,
  FiDollarSign,
  FiTrendingUp,
  FiUsers,
  FiClock,
  FiAlertCircle,
} from 'react-icons/fi';
import { Container } from '../components/layout/Container';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

interface FAQItem {
  category: string;
  icon: React.ElementType;
  questions: {
    question: string;
    answer: string;
  }[];
}

export const FAQPage: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  const toggleQuestion = (index: string) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqCategories: FAQItem[] = [
    {
      category: 'Getting Started',
      icon: FiHelpCircle,
      questions: [
        {
          question: 'What is Move Market?',
          answer:
            'Move Market is a decentralized prediction market platform built on the Aptos and Sui blockchains. It allows users to bet on the outcomes of real-world events using USDC stablecoin, regardless of which network they choose. All transactions are transparent, secure, and recorded on-chain.',
        },
        {
          question: 'How do I get started?',
          answer:
            'To get started: (1) Install a compatible wallet (Petra or Martian on Aptos, Suiet or Sui Wallet on Sui), (2) Connect your wallet to Move Market, (3) Get USDC on your chosen chain using our faucet or a bridge, (4) Browse markets and place your first bet. The entire process takes less than 5 minutes.',
        },
        {
          question: 'Do I need to create an account?',
          answer:
            'No account creation is required. Your Aptos or Sui wallet serves as your account. Simply connect your wallet and you are ready to start predicting. This means no email verification, no KYC (on testnet), and complete privacy.',
        },
        {
          question: 'What wallets are supported?',
          answer:
            'Move Market supports major Aptos wallets (Petra, Martian, Pontem, OKX) and Sui wallets (Suiet, Sui Wallet, Nightly) via the wallet adapter standards. We recommend Petra or Suiet for the smoothest experience on each chain.',
        },
      ],
    },
    {
      category: 'Markets & Betting',
      icon: FiTrendingUp,
      questions: [
        {
          question: 'What is a prediction market?',
          answer:
            'A prediction market is a trading platform where you can buy and sell shares representing the outcome of future events. Market prices reflect the collective wisdom of all participants. If the market shows 70% odds for an outcome, it means participants collectively believe there is a 70% chance of that outcome occurring.',
        },
        {
          question: 'What types of markets are available?',
          answer:
            'Move Market offers markets across multiple categories including cryptocurrency (price predictions, protocol upgrades), technology (adoption rates, product launches), sports (game outcomes, season winners), politics (election results, policy decisions), and entertainment (award shows, box office performance).',
        },
        {
          question: 'How are market odds determined?',
          answer:
            'Market odds are determined dynamically based on the ratio of bets placed on each outcome. If more people bet "Yes", the "Yes" odds increase and potential returns decrease. This creates a self-balancing market where odds reflect collective probability estimates.',
        },
        {
          question: 'Can I create my own market?',
          answer:
            'Currently, market creation is limited to verified creators to ensure quality and prevent spam. We are working on a community governance system that will allow anyone to propose markets. Approved creators must provide clear resolution criteria and event end dates.',
        },
        {
          question: 'What is the minimum bet amount?',
          answer:
            'The minimum bet amount is 1 USDC. There is no maximum bet limit, but very large bets will significantly move market odds. We recommend starting with smaller amounts while you learn how the platform works.',
        },
      ],
    },
    {
      category: 'Payments & Fees',
      icon: FiDollarSign,
      questions: [
        {
          question: 'What currency do I use to bet?',
          answer:
            'All bets are placed using USDC (USD Coin), a stablecoin pegged 1:1 to the US Dollar. This eliminates volatility concerns and makes it easy to calculate potential returns. On testnet, you can get free test USDC from our faucet.',
        },
        {
          question: 'What fees does Move Market charge?',
          answer:
            'Move Market charges a 2% platform fee on winning payouts only. If you lose, you pay no platform fee. Additionally, you will pay standard Aptos or Sui blockchain transaction fees (typically less than $0.001 per transaction). There are no deposit, withdrawal, or account maintenance fees.',
        },
        {
          question: 'How do I withdraw my winnings?',
          answer:
            'Winnings are paid directly to your connected wallet. After a market resolves, click "Claim Winnings" on your dashboard. Your USDC will be transferred to your wallet instantly. You can then use it to place more bets or withdraw to an exchange.',
        },
        {
          question: 'Are there any hidden fees?',
          answer:
            'No. All fees are transparent and disclosed upfront. The only fees you pay are: (1) 2% platform fee on winnings, and (2) Aptos or Sui blockchain gas fees (usually under $0.001). We never charge deposit, withdrawal, or inactivity fees.',
        },
      ],
    },
    {
      category: 'Market Resolution',
      icon: FiClock,
      questions: [
        {
          question: 'How are markets resolved?',
          answer:
            'Markets are resolved based on objective, verifiable data from trusted oracle sources. Each market specifies its resolution criteria when created. Once the event occurs or deadline passes, the oracle provides the outcome, and the smart contract automatically determines winners.',
        },
        {
          question: 'What happens if a market result is disputed?',
          answer:
            'We use a multi-oracle system to prevent manipulation. If oracle results conflict, a dispute resolution process is triggered. During disputes, payouts are delayed until consensus is reached. Our roadmap includes implementing a decentralized arbitration system for complex cases.',
        },
        {
          question: 'Can a market be cancelled?',
          answer:
            'Markets can only be cancelled under exceptional circumstances: (1) Event is cancelled or postponed indefinitely, (2) Resolution criteria become impossible to verify, or (3) Critical smart contract bug is discovered. If cancelled, all bets are refunded in full.',
        },
        {
          question: 'How long does it take to get paid after winning?',
          answer:
            'After a market resolves, winnings are immediately available to claim. Click "Claim Winnings" on your dashboard and funds are transferred to your wallet within seconds. There is no waiting period or manual review process.',
        },
      ],
    },
    {
      category: 'Security & Safety',
      icon: FiShield,
      questions: [
        {
          question: 'Is my money safe?',
          answer:
            'Yes. All funds are secured by audited Move smart contracts on Aptos and Sui, not held by Move Market. The Move programming language has built-in safety features that prevent common vulnerabilities. Our contracts will undergo professional security audits before mainnet launch.',
        },
        {
          question: 'Can Move Market access my funds?',
          answer:
            'No. Move Market cannot access, freeze, or control your funds. When you place a bet, funds are transferred directly to the smart contract. Only you can claim winnings after market resolution. This is the power of decentralization.',
        },
        {
          question: 'What if I lose my wallet private key?',
          answer:
            'If you lose your wallet private key, your funds cannot be recovered by Move Market or anyone else. This is why it is critical to: (1) Backup your seed phrase securely, (2) Never share your private key, (3) Use a hardware wallet for large amounts. Wallet security is your responsibility.',
        },
        {
          question: 'Has the smart contract been audited?',
          answer:
            'The current testnet version has not been audited. Before mainnet launch, our smart contracts will undergo comprehensive security audits by firms like CertiK and Trail of Bits. We will also launch a bug bounty program offering rewards for vulnerability discoveries.',
        },
      ],
    },
    {
      category: 'Legal & Compliance',
      icon: FiAlertCircle,
      questions: [
        {
          question: 'Is prediction market betting legal?',
          answer:
            'Legality varies by jurisdiction. In the US, CFTC-regulated prediction markets like Kalshi are legal. Blockchain-based prediction markets operate in a gray area. Users are responsible for understanding and complying with their local laws. Move Market is currently for entertainment and educational purposes only.',
        },
        {
          question: 'Do I need to pay taxes on winnings?',
          answer:
            'Tax obligations vary by country. In most jurisdictions, prediction market winnings are considered taxable income or capital gains. You are responsible for reporting winnings to your tax authority. Move Market does not provide tax advice - consult a tax professional for guidance.',
        },
        {
          question: 'What is your KYC policy?',
          answer:
            'Currently on testnet, no KYC is required. For mainnet launch, KYC requirements will depend on regulatory landscape and jurisdictions served. We are committed to finding the right balance between compliance and user privacy.',
        },
        {
          question: 'Where is Move Market available?',
          answer:
            'Move Market testnet is available globally. However, users must comply with their local laws regarding prediction markets and cryptocurrency. Some jurisdictions prohibit online betting or crypto usage. Access does not constitute legal advice or endorsement.',
        },
      ],
    },
    {
      category: 'Technical',
      icon: FiUsers,
      questions: [
        {
          question: 'What blockchain does Move Market use?',
          answer:
            'Move Market is built on the Aptos and Sui blockchains, high-performance Layer 1s that use the Move programming language. Together they offer sub-second finality and extremely low fees (typically under $0.001 per transaction).',
        },
        {
          question: 'Why Move chains (Aptos & Sui) instead of Ethereum or Polygon?',
          answer:
            'Aptos and Sui offer superior performance (sub-second finality versus multi-second finality on Polygon), lower costs (fractions of a cent instead of $0.01-$0.05), and stronger safety guarantees through the Move language. This translates to better user experience and lower costs for you.',
        },
        {
          question: 'Can I trade my position before market resolution?',
          answer:
            'Position trading is on our roadmap but not currently available. Once implemented, you will be able to buy and sell your positions on a secondary market, allowing you to lock in profits or cut losses before the event resolves.',
        },
        {
          question: 'What happens during network congestion?',
          answer:
            'Aptos and Sui are designed to handle high throughput without congestion. Even under heavy load, transactions typically confirm in under one second. In rare cases of extreme network stress, your transaction may take a few seconds longer but fees remain stable.',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-16 lg:py-24 transition-colors">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge variant="primary" className="mb-6">
              Your Questions Answered
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-gray-900 dark:text-white mb-6 leading-tight transition-colors">
              Frequently Asked Questions
            </h1>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed transition-colors">
              Everything you need to know about Move Market, prediction markets, and blockchain betting.
            </p>
          </motion.div>
        </Container>
      </section>

      {/* FAQ Categories */}
      <section className="py-16 lg:py-24">
        <Container>
          <div className="space-y-12">
            {faqCategories.map((category, categoryIndex) => (
              <motion.div
                key={category.category}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: categoryIndex * 0.1 }}
              >
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-xl flex items-center justify-center transition-colors">
                    <category.icon className="w-6 h-6 text-primary-500" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-gray-900 dark:text-white transition-colors">
                    {category.category}
                  </h2>
                </div>

                {/* Questions */}
                <div className="space-y-4">
                  {category.questions.map((item, questionIndex) => {
                    const itemIndex = `${categoryIndex}-${questionIndex}`;
                    const isOpen = openIndex === itemIndex;

                    return (
                      <Card
                        key={itemIndex}
                        padding="none"
                        className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => toggleQuestion(itemIndex)}
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 transition-colors">
                              {item.question}
                            </h3>
                            <div className="flex-shrink-0 mt-1">
                              {isOpen ? (
                                <FiChevronUp className="w-5 h-5 text-primary-500" />
                              ) : (
                                <FiChevronDown className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                          </div>

                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 transition-colors">
                                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed transition-colors">
                                    {item.answer}
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* Still Have Questions CTA */}
      <section className="py-16 lg:py-24 bg-gray-50 dark:bg-gray-800 transition-colors">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <Card padding="lg" className="text-center bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/20 dark:to-gray-800 border-primary-200 dark:border-primary-800 transition-colors">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-colors">
                <FiHelpCircle className="w-8 h-8 text-primary-500" />
              </div>
              <h2 className="text-2xl md:text-3xl font-display font-bold text-gray-900 dark:text-white mb-4 transition-colors">
                Still Have Questions?
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 leading-relaxed transition-colors">
                Cannot find the answer you are looking for? Check out our comprehensive guide or reach out to our community.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/how-it-works">
                  <Button variant="primary" size="lg">
                    Read How It Works
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => window.open('https://discord.gg/movemarket', '_blank')}
                >
                  Join Our Discord
                </Button>
              </div>
            </Card>
          </motion.div>
        </Container>
      </section>

      {/* Quick Links */}
      <section className="py-16 lg:py-24 bg-white dark:bg-gray-900 transition-colors">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900 dark:text-white mb-4 transition-colors">
              Helpful Resources
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 transition-colors">
              Explore more to get the most out of Move Market
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            <Link to="/how-it-works">
              <Card hover padding="lg" className="text-center h-full">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-xl flex items-center justify-center mx-auto mb-4 transition-colors">
                  <FiHelpCircle className="w-6 h-6 text-primary-500" />
                </div>
                <h3 className="text-xl font-display font-bold text-gray-900 dark:text-white mb-2 transition-colors">
                  How It Works
                </h3>
                <p className="text-gray-600 dark:text-gray-300 transition-colors">
                  Learn the basics of prediction markets and how to get started
                </p>
              </Card>
            </Link>

            <Link to="/markets">
              <Card hover padding="lg" className="text-center h-full">
                <div className="w-12 h-12 bg-success-100 dark:bg-success-900 rounded-xl flex items-center justify-center mx-auto mb-4 transition-colors">
                  <FiTrendingUp className="w-6 h-6 text-success-500" />
                </div>
                <h3 className="text-xl font-display font-bold text-gray-900 dark:text-white mb-2 transition-colors">
                  Browse Markets
                </h3>
                <p className="text-gray-600 dark:text-gray-300 transition-colors">
                  Explore active prediction markets and start betting
                </p>
              </Card>
            </Link>

            <Link to="/dashboard">
              <Card hover padding="lg" className="text-center h-full">
                <div className="w-12 h-12 bg-warning-100 dark:bg-warning-900 rounded-xl flex items-center justify-center mx-auto mb-4 transition-colors">
                  <FiUsers className="w-6 h-6 text-warning-500" />
                </div>
                <h3 className="text-xl font-display font-bold text-gray-900 dark:text-white mb-2 transition-colors">
                  Your Dashboard
                </h3>
                <p className="text-gray-600 dark:text-gray-300 transition-colors">
                  Track your bets, positions, and winnings in one place
                </p>
              </Card>
            </Link>
          </div>
        </Container>
      </section>
    </div>
  );
};

export default FAQPage;
