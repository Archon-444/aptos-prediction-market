import React from 'react';
import { motion } from 'framer-motion';
import { FiClock, FiUsers, FiTrendingUp } from 'react-icons/fi';

interface FeaturedMarketCardProps {
  title: string;
  category: string;
  volume: string;
  odds: { yes: number; no: number };
  endsIn: string;
  participants?: number;
  onClick?: () => void;
  index: number;
}

const CARD_STYLES = [
  {
    gradient: 'from-blue-600 via-blue-800 to-indigo-900',
    glow: 'rgba(59,130,246,0.35)',
    accent: '#60A5FA',
  },
  {
    gradient: 'from-violet-600 via-violet-800 to-purple-900',
    glow: 'rgba(139,92,246,0.35)',
    accent: '#A78BFA',
  },
  {
    gradient: 'from-emerald-600 via-teal-800 to-cyan-900',
    glow: 'rgba(16,185,129,0.35)',
    accent: '#34D399',
  },
  {
    gradient: 'from-rose-600 via-pink-800 to-purple-900',
    glow: 'rgba(244,63,94,0.35)',
    accent: '#FB7185',
  },
];

export const FeaturedMarketCard: React.FC<FeaturedMarketCardProps> = ({
  title,
  category,
  volume,
  odds,
  endsIn,
  participants,
  onClick,
  index,
}) => {
  const style = CARD_STYLES[index % CARD_STYLES.length];

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClick}
      className="group cursor-pointer h-full"
    >
      <div
        className={`relative h-72 w-full overflow-hidden rounded-2xl bg-gradient-to-br ${style.gradient} border border-white/10`}
        style={{
          boxShadow: `0 8px 40px ${style.glow}, 0 2px 8px rgba(0,0,0,0.4)`,
        }}
      >
        {/* Ambient glow orb */}
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition-opacity duration-300"
          style={{ background: style.accent }}
        />

        {/* Bottom fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

        {/* Top highlight line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-between p-6">
          {/* Top row: category + volume */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full border border-white/[0.12]">
              {category}
            </span>
            <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full border border-white/[0.12]">
              <FiTrendingUp className="w-3 h-3 text-white/60" />
              <span className="text-[11px] font-semibold text-white/90">{volume}</span>
            </div>
          </div>

          {/* Bottom: title + odds + meta */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white leading-snug line-clamp-2 drop-shadow-lg">
              {title}
            </h3>

            {/* Odds bar */}
            <div className="space-y-2">
              <div className="relative w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/[0.07]">
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${odds.yes}%`,
                    background: 'linear-gradient(90deg, #34D399, #10B981)',
                  }}
                />
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span style={{ color: '#34D399' }}>YES {odds.yes}%</span>
                <span className="text-slate-500">NO {odds.no}%</span>
              </div>
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between text-[11px] text-white/40 font-medium">
              <div className="flex items-center gap-1.5">
                <FiClock className="w-3 h-3" />
                <span>{endsIn}</span>
              </div>
              {participants != null && (
                <div className="flex items-center gap-1.5">
                  <FiUsers className="w-3 h-3" />
                  <span>{participants.toLocaleString()} traders</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default FeaturedMarketCard;
