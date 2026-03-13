import React from 'react';

interface PremiumContainerProps {
    children: React.ReactNode;
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    /** Whether to show the background glow effects */
    showGlow?: boolean;
}

const sizeClasses = {
    sm: 'max-w-3xl',
    md: 'max-w-5xl',
    lg: 'max-w-7xl',
    xl: 'max-w-[1400px]',
    full: 'max-w-full',
};

/**
 * PremiumContainer - A reusable dark-themed container with rounded corners and optional glow effects
 * Used to maintain consistent premium UI across all pages
 */
export const PremiumContainer: React.FC<PremiumContainerProps> = ({
    children,
    className = '',
    size = 'lg',
    showGlow = true,
}) => {
    return (
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${sizeClasses[size]} py-12 lg:py-20`}>
            <div className={`bg-[#0A0E27] rounded-[40px] p-8 md:p-12 lg:p-16 relative overflow-hidden border border-white/5 shadow-2xl ${className}`}>
                {/* Background Glows */}
                {showGlow && (
                    <>
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[100px] pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary-500/10 rounded-full blur-[100px] pointer-events-none" />
                    </>
                )}

                {/* Content */}
                <div className="relative z-10">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default PremiumContainer;
