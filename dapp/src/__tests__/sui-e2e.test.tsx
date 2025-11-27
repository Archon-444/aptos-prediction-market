/**
 * Sui End-to-End Integration Tests
 * 
 * Comprehensive test coverage for Sui betting and settlement flows
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChainProvider } from '../contexts/ChainContext';
import { SuiWalletProvider } from '../contexts/SuiWalletContext';
import { SDKProvider } from '../contexts/SDKContext';
import MarketsPage from '../pages/MarketsPage';
import MarketDetailPage from '../pages/MarketDetailPage';
import CreateMarketPage from '../pages/CreateMarketPage';
import { useChainPlaceBet } from '../hooks/useChainTransactions';
import { useChainClaimWinnings } from '../hooks/useChainTransactions';

// Mock Sui wallet
const mockSuiWallet = {
  connected: true,
  account: {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    publicKey: 'mock-public-key',
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
  signAndExecuteTransactionBlock: vi.fn(),
  signMessage: vi.fn(),
};

// Mock SDK
const mockSDK = {
  getModuleAddress: vi.fn(() => '0xpackage123'),
  toMicroUSDC: vi.fn((amount: number) => amount * 1000000),
  getRoleRegistryId: vi.fn(() => '0xrole123'),
  getOracleRegistryId: vi.fn(() => '0xoracle123'),
};

// Mock market data
const mockSuiMarket = {
  id: '1',
  onChainId: '123',
  chain: 'sui',
  question: 'Will Sui reach $10 by end of 2024?',
  outcomes: ['Yes', 'No'],
  status: 'active',
  outcomePools: [1500000n, 2500000n],
  totalVolume: 4000000n,
  endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  liquidityParam: 1000000n,
  createdAt: new Date(),
  lastSyncedAt: new Date(),
  suiMarketObjectId: '0xmarket123',
  suiShardObjectIds: ['0xshard0', '0xshard1'],
  suiQueueObjectId: '0xqueue123',
};

// Mock API responses
const mockApiResponses = {
  '/api/markets': {
    success: true,
    data: [mockSuiMarket],
  },
  '/api/markets/1': {
    success: true,
    data: mockSuiMarket,
  },
  '/api/markets/sui-objects/1': {
    success: true,
    data: {
      marketObjectId: '0xmarket123',
      shardObjectIds: ['0xshard0', '0xshard1'],
      queueObjectId: '0xqueue123',
    },
  },
};

// Mock fetch globally
global.fetch = vi.fn();

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <ChainProvider>
      <SuiWalletProvider>
        <SDKProvider>
          {children}
        </SDKProvider>
      </SuiWalletProvider>
    </ChainProvider>
  </BrowserRouter>
);

describe('Sui End-to-End Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch responses
    (global.fetch as any).mockImplementation((url: string) => {
      const response = mockApiResponses[url as keyof typeof mockApiResponses];
      if (response) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    // Mock Sui wallet in window
    Object.defineProperty(window, 'suiWallet', {
      value: mockSuiWallet,
      writable: true,
    });

    // Mock SDK in context
    vi.mock('../contexts/SDKContext', () => ({
      useSDKContext: () => ({ sdk: mockSDK }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Market Discovery and Display', () => {
    it('should display Sui markets on markets page', async () => {
      render(
        <TestWrapper>
          <MarketsPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Will Sui reach $10 by end of 2024?')).toBeInTheDocument();
      });

      // Should show Sui chain indicator
      expect(screen.getByText('SUI')).toBeInTheDocument();
    });

    it('should show market details for Sui market', async () => {
      render(
        <TestWrapper>
          <MarketDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Will Sui reach $10 by end of 2024?')).toBeInTheDocument();
      });

      // Should show outcome options
      expect(screen.getByText('Yes')).toBeInTheDocument();
      expect(screen.getByText('No')).toBeInTheDocument();
    });
  });

  describe('Market Creation Flow', () => {
    it('should create Sui market successfully', async () => {
      const mockCreateMarket = vi.fn().mockResolvedValue({
        hash: '0xtx123',
        success: true,
      });

      vi.mock('../hooks/useChainTransactions', () => ({
        useChainCreateMarket: () => ({
          createMarket: mockCreateMarket,
          isLoading: false,
        }),
      }));

      render(
        <TestWrapper>
          <CreateMarketPage />
        </TestWrapper>
      );

      // Fill out market creation form
      const questionInput = screen.getByPlaceholderText(/enter your prediction question/i);
      fireEvent.change(questionInput, { target: { value: 'Test Sui market?' } });

      const outcomeInput = screen.getByPlaceholderText(/outcome 1/i);
      fireEvent.change(outcomeInput, { target: { value: 'Yes' } });

      const createButton = screen.getByText(/create market/i);
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockCreateMarket).toHaveBeenCalledWith({
          question: 'Test Sui market?',
          outcomes: ['Yes', 'No'],
          endDate: expect.any(Date),
          category: expect.any(String),
          resolutionSource: expect.any(String),
        });
      });
    });
  });

  describe('Betting Flow', () => {
    it('should place bet on Sui market successfully', async () => {
      const mockPlaceBet = vi.fn().mockResolvedValue({
        hash: '0xbet123',
        success: true,
      });

      vi.mock('../hooks/useChainTransactions', () => ({
        useChainPlaceBet: () => ({
          placeBet: mockPlaceBet,
          isLoading: false,
        }),
      }));

      render(
        <TestWrapper>
          <MarketDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Will Sui reach $10 by end of 2024?')).toBeInTheDocument();
      });

      // Click on Yes outcome
      const yesButton = screen.getByText('Yes');
      fireEvent.click(yesButton);

      // Enter bet amount
      const amountInput = screen.getByPlaceholderText(/enter amount/i);
      fireEvent.change(amountInput, { target: { value: '10' } });

      // Click place bet
      const placeBetButton = screen.getByText(/place bet/i);
      fireEvent.click(placeBetButton);

      await waitFor(() => {
        expect(mockPlaceBet).toHaveBeenCalledWith(1, 0, 10);
      });
    });

    it('should handle bet placement errors gracefully', async () => {
      const mockPlaceBet = vi.fn().mockRejectedValue(new Error('Insufficient funds'));

      vi.mock('../hooks/useChainTransactions', () => ({
        useChainPlaceBet: () => ({
          placeBet: mockPlaceBet,
          isLoading: false,
        }),
      }));

      render(
        <TestWrapper>
          <MarketDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Will Sui reach $10 by end of 2024?')).toBeInTheDocument();
      });

      // Click on Yes outcome
      const yesButton = screen.getByText('Yes');
      fireEvent.click(yesButton);

      // Enter bet amount
      const amountInput = screen.getByPlaceholderText(/enter amount/i);
      fireEvent.change(amountInput, { target: { value: '10' } });

      // Click place bet
      const placeBetButton = screen.getByText(/place bet/i);
      fireEvent.click(placeBetButton);

      await waitFor(() => {
        expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
      });
    });
  });

  describe('Settlement Flow', () => {
    it('should request settlement for Sui market successfully', async () => {
      const mockClaimWinnings = vi.fn().mockResolvedValue({
        hash: '0xclaim123',
        success: true,
      });

      vi.mock('../hooks/useChainTransactions', () => ({
        useChainClaimWinnings: () => ({
          claimWinnings: mockClaimWinnings,
          isLoading: false,
        }),
      }));

      // Mock resolved market
      const resolvedMarket = {
        ...mockSuiMarket,
        status: 'resolved',
        resolvedOutcome: 0,
        resolvedAt: new Date(),
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url === '/api/markets/1') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: resolvedMarket }),
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      render(
        <TestWrapper>
          <MarketDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Will Sui reach $10 by end of 2024?')).toBeInTheDocument();
      });

      // Should show claim button for resolved market
      const claimButton = screen.getByText(/claim winnings/i);
      fireEvent.click(claimButton);

      await waitFor(() => {
        expect(mockClaimWinnings).toHaveBeenCalledWith(1, '0xposition123');
      });
    });

    it('should handle settlement errors gracefully', async () => {
      const mockClaimWinnings = vi.fn().mockRejectedValue(new Error('Settlement failed'));

      vi.mock('../hooks/useChainTransactions', () => ({
        useChainClaimWinnings: () => ({
          claimWinnings: mockClaimWinnings,
          isLoading: false,
        }),
      }));

      render(
        <TestWrapper>
          <MarketDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Will Sui reach $10 by end of 2024?')).toBeInTheDocument();
      });

      const claimButton = screen.getByText(/claim winnings/i);
      fireEvent.click(claimButton);

      await waitFor(() => {
        expect(screen.getByText(/settlement failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Chain Switching', () => {
    it('should switch between Aptos and Sui chains', async () => {
      render(
        <TestWrapper>
          <MarketsPage />
        </TestWrapper>
      );

      // Should show current chain
      expect(screen.getByText(/aptos/i)).toBeInTheDocument();

      // Click chain switcher
      const chainSwitcher = screen.getByRole('button', { name: /switch chain/i });
      fireEvent.click(chainSwitcher);

      // Select Sui
      const suiOption = screen.getByText(/sui/i);
      fireEvent.click(suiOption);

      await waitFor(() => {
        expect(screen.getByText(/sui/i)).toBeInTheDocument();
      });
    });
  });

  describe('Wallet Integration', () => {
    it('should connect Sui wallet successfully', async () => {
      render(
        <TestWrapper>
          <MarketsPage />
        </TestWrapper>
      );

      const connectButton = screen.getByText(/connect wallet/i);
      fireEvent.click(connectButton);

      // Should show wallet modal
      expect(screen.getByText(/connect wallet/i)).toBeInTheDocument();

      // Click Sui wallet option
      const suiWalletOption = screen.getByText(/sui wallet/i);
      fireEvent.click(suiWalletOption);

      await waitFor(() => {
        expect(mockSuiWallet.connect).toHaveBeenCalled();
      });
    });

    it('should display Sui wallet balance correctly', async () => {
      // Mock wallet with balance
      const walletWithBalance = {
        ...mockSuiWallet,
        balance: '1000.50',
      };

      Object.defineProperty(window, 'suiWallet', {
        value: walletWithBalance,
        writable: true,
      });

      render(
        <TestWrapper>
          <MarketsPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('1000.50')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <MarketsPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load markets/i)).toBeInTheDocument();
      });
    });

    it('should handle invalid market data', async () => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (url === '/api/markets') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: [{
                id: '1',
                // Missing required fields
                question: 'Invalid market',
              }],
            }),
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      render(
        <TestWrapper>
          <MarketsPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/invalid market data/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Loading States', () => {
    it('should show loading states during async operations', async () => {
      const mockPlaceBet = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ hash: '0xbet123', success: true }), 1000))
      );

      vi.mock('../hooks/useChainTransactions', () => ({
        useChainPlaceBet: () => ({
          placeBet: mockPlaceBet,
          isLoading: true,
        }),
      }));

      render(
        <TestWrapper>
          <MarketDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Will Sui reach $10 by end of 2024?')).toBeInTheDocument();
      });

      const yesButton = screen.getByText('Yes');
      fireEvent.click(yesButton);

      const amountInput = screen.getByPlaceholderText(/enter amount/i);
      fireEvent.change(amountInput, { target: { value: '10' } });

      const placeBetButton = screen.getByText(/place bet/i);
      fireEvent.click(placeBetButton);

      // Should show loading state
      expect(screen.getByText(/placing bet/i)).toBeInTheDocument();
    });
  });
});
