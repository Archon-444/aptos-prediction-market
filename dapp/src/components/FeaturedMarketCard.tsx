import React from 'react';
import { motion } from 'framer-motion';
import { FiTrendingUp } from 'react-icons/fi';

interface FeaturedMarketCardProps {
    title: string;
    category: string;
    volume: string;
    odds: { yes: number; no: number };
    endsIn: string;
    onClick?: () => void;
    index: number;
}

const GRADIENTS = [
    'bg-gradient-to-r from-purple-600 to-blue-600',
    'bg-gradient-to-r from-cyan-500 to-blue-500',
    'bg-gradient-to-r from-orange-500 to-red-500',
    'bg-gradient-to-r from-pink-500 to-rose-500',
];

export const FeaturedMarketCard: React.FC<FeaturedMarketCardProps> = ({
    title,
    category,
    volume,
    odds,
    endsIn,
    onClick,
    index,
}) => {
    const gradient = GRADIENTS[index % GRADIENTS.length];

    return (
        <div className="group cursor-pointer" onClick={onClick}>
            {/* Main Card Area */}
            <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className={`relative h-64 w-full overflow-hidden rounded-[32px] ${gradient} shadow-lg`}
            >
                {/* Abstract Overlay/Pattern */}
                <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay" />

                {/* Dark Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Content Inside Card */}
                <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                    <h3 className="text-xl font-display font-bold text-white leading-tight max-w-[70%] text-shadow-sm">
                        {title}
                    </h3>

                    {/* Stat Badge */}
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-full">
                        <span className="text-xs font-medium text-white/90">
                            Vol: {volume}
                        </span>
                    </div>
                </div>
            </motion.div>

            {/* Metadata Below Card */}
            <div className="mt-4 flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                        {category}
                    </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-success-500" />
                        Active
                    </span>
                    <span>Ends in {endsIn}</span>
                </div>
            </div>
        </div>
    );
};
