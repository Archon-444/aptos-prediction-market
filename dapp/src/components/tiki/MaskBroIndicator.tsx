import React from 'react';

/**
 * MaskBro types correspond to oracle personalities
 */
export type MaskBroType = 'smirk' | 'sad' | 'wise' | 'crazy' | 'chill';

/**
 * Market sentiment as determined by odds
 */
export type Sentiment = 'bullish' | 'bearish' | 'neutral';

export interface MaskBroIndicatorProps {
  /**
   * Which MaskBro character to display
   */
  type: MaskBroType;

  /**
   * Current market sentiment
   */
  sentiment: Sentiment;

  /**
   * Confidence level (1-10 scale)
   * Higher = more certain about prediction
   */
  confidence?: number;

  /**
   * Show full name or just emoji
   */
  compact?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Configuration for each MaskBro character
 * Maps personality traits to visual representation
 */
const maskBroConfig: Record<MaskBroType, {
  emoji: string;
  name: string;
  color: string;
  description: string;
}> = {
  smirk: {
    emoji: '😏',
    name: 'SmirkBro',
    color: 'text-tiki-mango',
    description: 'Optimistic consensus weight'
  },
  sad: {
    emoji: '😔',
    name: 'SadBro',
    color: 'text-tiki-sunset',
    description: 'Bearish signal detector'
  },
  wise: {
    emoji: '🧙',
    name: 'WiseBro',
    color: 'text-tiki-lagoon',
    description: 'Historical accuracy reputation'
  },
  crazy: {
    emoji: '🤪',
    name: 'CrazyBro',
    color: 'text-tiki-volcano',
    description: 'High-volatility specialist'
  },
  chill: {
    emoji: '😎',
    name: 'ChillBro',
    color: 'text-tiki-turquoise',
    description: 'Balanced perspective'
  },
};

/**
 * Text labels for sentiment
 */
const sentimentText: Record<Sentiment, string> = {
  bullish: 'BULLISH',
  bearish: 'BEARISH',
  neutral: 'UNSURE',
};

/**
 * Background colors for sentiment
 */
const sentimentBg: Record<Sentiment, string> = {
  bullish: 'bg-tiki-bamboo/20',
  bearish: 'bg-tiki-volcano/20',
  neutral: 'bg-tiki-driftwood/20',
};

/**
 * MaskBroIndicator Component
 *
 * Displays which MaskBro agrees with a market and their confidence level.
 * Used on market cards to gamify oracle consensus.
 *
 * @example
 * ```tsx
 * <MaskBroIndicator
 *   type="smirk"
 *   sentiment="bullish"
 *   confidence={8}
 * />
 * ```
 */
export const MaskBroIndicator: React.FC<MaskBroIndicatorProps> = ({
  type,
  sentiment,
  confidence,
  compact = false,
  className = '',
}) => {
  const bro = maskBroConfig[type];

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <span className="text-lg">{bro.emoji}</span>
        {confidence && (
          <span className={`text-xs font-bold ${bro.color}`}>
            {confidence}/10
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`
        flex items-center gap-2
        ${sentimentBg[sentiment]}
        rounded-full px-3 py-1.5
        border border-tiki-driftwood/30
        ${className}
      `}
      title={bro.description}
    >
      {/* MaskBro Emoji */}
      <span className="text-xl animate-bounce-slow">
        {bro.emoji}
      </span>

      {/* Name and Sentiment */}
      <div className="flex flex-col">
        <span className={`text-xs font-baloo font-semibold ${bro.color}`}>
          {bro.name}: {sentimentText[sentiment]}
        </span>

        {/* Confidence Bar (optional) */}
        {confidence !== undefined && (
          <div className="flex gap-0.5 mt-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`
                  w-1 h-2 rounded-full transition-all duration-300
                  ${i < confidence
                    ? 'bg-tiki-mango shadow-glow-mango'
                    : 'bg-tiki-driftwood/30'
                  }
                `}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Constants for MaskBro selection thresholds
const BULLISH_THRESHOLD = 60;      // >60% = strong YES sentiment
const BEARISH_THRESHOLD = 40;      // <40% = strong NO sentiment
const CHILL_RANGE_LOWER = 45;      // 45-55% = toss-up market
const CHILL_RANGE_UPPER = 55;
const HIGH_VOLATILITY_THRESHOLD = 20; // >20% volatility = CrazyBro
const HIGH_VOLUME_THRESHOLD = 10000; // >$10k volume = WiseBro
const VOLUME_SCALING_FACTOR = 1000; // $1000 USDC = +1 confidence
const BASE_CONFIDENCE = 3;          // Minimum confidence for any market
const MAX_CONFIDENCE = 10;          // Maximum confidence level

/**
 * Helper function to determine which MaskBro to show based on market data
 *
 * @param yesOdds - Percentage odds for YES outcome (0-100)
 * @param volume - Total market volume in USDC (must be >= 0)
 * @param volatility - Market volatility indicator (optional, must be >= 0)
 * @returns Recommended MaskBro type and sentiment
 */
export function selectMaskBro(
  yesOdds: number,
  volume: number,
  volatility?: number
): { type: MaskBroType; sentiment: Sentiment; confidence: number } {
  // Input validation - clamp values to valid ranges
  if (yesOdds < 0 || yesOdds > 100) {
    console.warn(`[MaskBro] yesOdds out of range (0-100): ${yesOdds}, clamping to valid range`);
    yesOdds = Math.max(0, Math.min(100, yesOdds));
  }

  if (volume < 0) {
    console.warn(`[MaskBro] Volume cannot be negative: ${volume}, setting to 0`);
    volume = 0;
  }

  if (volatility !== undefined && volatility < 0) {
    console.warn(`[MaskBro] Volatility cannot be negative: ${volatility}, setting to 0`);
    volatility = 0;
  }

  // Determine sentiment from odds
  const sentiment: Sentiment =
    yesOdds > BULLISH_THRESHOLD ? 'bullish' :
    yesOdds < BEARISH_THRESHOLD ? 'bearish' :
    'neutral';

  // Calculate confidence based on volume (higher volume = higher confidence)
  const confidence = Math.min(
    MAX_CONFIDENCE,
    Math.floor((volume / VOLUME_SCALING_FACTOR) + BASE_CONFIDENCE)
  );

  // Select MaskBro based on characteristics (priority order)
  let type: MaskBroType;

  if (volatility && volatility > HIGH_VOLATILITY_THRESHOLD) {
    // High volatility = CrazyBro
    type = 'crazy';
  } else if (yesOdds >= CHILL_RANGE_LOWER && yesOdds <= CHILL_RANGE_UPPER) {
    // Toss-up market = ChillBro
    type = 'chill';
  } else if (volume > HIGH_VOLUME_THRESHOLD) {
    // High volume mature market = WiseBro
    type = 'wise';
  } else if (yesOdds > BULLISH_THRESHOLD) {
    // Bullish = SmirkBro
    type = 'smirk';
  } else {
    // Bearish = SadBro
    type = 'sad';
  }

  return { type, sentiment, confidence };
}

export default MaskBroIndicator;
