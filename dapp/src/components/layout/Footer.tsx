import React from 'react';
import { Link } from 'react-router-dom';
import { FiTwitter, FiGithub, FiMessageCircle, FiTrendingUp } from 'react-icons/fi';
import { Container } from './Container';

export const Footer: React.FC = () => {
  const footerLinks = {
    product: [
      { label: 'Markets', href: '/markets' },
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'FAQ', href: '/faq' },
    ],
    resources: [
      { label: 'Documentation', href: '/docs' },
      { label: 'API', href: '/api' },
      { label: 'Smart Contracts', href: '/contracts' },
    ],
    company: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
    ],
    legal: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
    ],
  };

  const socialLinks = [
    { icon: FiTwitter, href: 'https://twitter.com', label: 'Twitter' },
    { icon: FiGithub, href: 'https://github.com', label: 'GitHub' },
    { icon: FiMessageCircle, href: 'https://discord.com', label: 'Discord' },
  ];

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-auto transition-colors">
      <Container>
        <div className="py-12 lg:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-md">
                  <FiTrendingUp className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-display font-bold text-gray-900 dark:text-white transition-colors">
                  Move Market
                </span>
              </Link>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 transition-colors">
                Decentralized prediction markets on Aptos blockchain.
              </p>
              <div className="flex space-x-4">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:border-primary-500 hover:text-primary-500 transition-colors"
                    aria-label={social.label}
                  >
                    <social.icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            <div>
              <h3 className="font-display font-bold text-gray-900 dark:text-white mb-4 transition-colors">Product</h3>
              <ul className="space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-display font-bold text-gray-900 dark:text-white mb-4 transition-colors">Resources</h3>
              <ul className="space-y-3">
                {footerLinks.resources.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-display font-bold text-gray-900 dark:text-white mb-4 transition-colors">Company</h3>
              <ul className="space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 transition-colors">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                © {new Date().getFullYear()} Move Market. All rights reserved.
              </p>
              <div className="flex space-x-6">
                <Link
                  to="/privacy"
                  className="text-sm text-gray-600 hover:text-primary-500 transition-colors"
                >
                  Privacy Policy
                </Link>
                <Link
                  to="/terms"
                  className="text-sm text-gray-600 hover:text-primary-500 transition-colors"
                >
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
