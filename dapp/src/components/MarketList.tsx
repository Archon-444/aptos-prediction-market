import React, { useState, useEffect, useCallback } from 'react';
import { useAptos } from '../contexts/WalletContext';
import { sanitizeMarketQuestion, sanitizeText } from '../utils/sanitize';
import { env } from '../config/env';

interface Market {
  id: number;
  question: string;
  outcomes: string[];
  endTime: number;
  resolved: boolean;
  winningOutcome: number;
  outcomeStakes: number[];
  creator: string;
}

const MarketList: React.FC = () => {
  const { getClient } = useAptos();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMarkets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get market count
      const moduleAddress = env.aptosModuleAddress;
      const aptos = await getClient();
      const countResponse = await aptos.view({
        payload: {
          function: `${moduleAddress}::market_manager::get_market_count`,
          typeArguments: [],
          functionArguments: []
        }
      } as any);

      const marketCount = Number(countResponse[0]);
      const marketPromises = [];

      // Load each market
      for (let i = 0; i < marketCount; i++) {
        marketPromises.push(
          aptos.view({
            payload: {
              function: `${moduleAddress}::market_manager::get_market_full`,
              typeArguments: [],
              functionArguments: [i]
            }
          } as any).then(response => {
            // Use browser-safe hex to UTF-8 decoding
            const hexToUtf8 = (hex: string): string => {
              const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
              return new TextDecoder().decode(bytes);
            };

            const rawQuestion = hexToUtf8(response[0] as string);
            const rawOutcomes = (response[1] as string[]).map(outcome => hexToUtf8(outcome));

            return {
              id: i,
              question: sanitizeMarketQuestion(rawQuestion),
              outcomes: rawOutcomes.map(outcome => sanitizeText(outcome)),
              endTime: Number(response[2]),
              resolved: response[3] as boolean,
              winningOutcome: Number(response[4]),
              outcomeStakes: (response[5] as number[]).map(Number),
              creator: response[6] as string
            };
          })
        );
      }
      
      const marketData = await Promise.all(marketPromises);
      setMarkets(marketData);
    } catch (err) {
      console.error('Failed to load markets:', err);
      setError('Failed to load markets. Make sure the contract is deployed.');
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const getTimeRemaining = (endTime: number) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = endTime - now;
    
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading markets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: '#dc3545' }}>{error}</p>
        <button 
          onClick={loadMarkets}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            marginTop: '1rem'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Prediction Markets</h2>
        <button 
          onClick={loadMarkets}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer'
          }}
        >
          Refresh
        </button>
      </div>

      {markets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          <p>No markets found. Create the first market!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {markets.map((market) => (
            <div
              key={market.id}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: '0.5rem',
                padding: '1.5rem',
                backgroundColor: '#fff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem 0' }}>
                  {market.question}
                </h3>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#666' }}>
                  <span>ID: {market.id}</span>
                  <span>Ends: {formatTime(market.endTime)}</span>
                  <span>Status: {market.resolved ? 'Resolved' : getTimeRemaining(market.endTime)}</span>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0' }}>Outcomes:</h4>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {market.outcomes.map((outcome, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: market.resolved && market.winningOutcome === index 
                          ? '#d4edda' 
                          : '#f8f9fa',
                        border: market.resolved && market.winningOutcome === index 
                          ? '1px solid #c3e6cb' 
                          : '1px solid #dee2e6',
                        borderRadius: '0.25rem',
                        fontSize: '0.875rem'
                      }}
                    >
                      {outcome} ({market.outcomeStakes[index]} APT)
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  View Details
                </button>
                {!market.resolved && (
                  <button
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Place Bet
                  </button>
                )}
                {market.resolved && (
                  <button
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#ffc107',
                      color: 'black',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Redeem
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketList;
