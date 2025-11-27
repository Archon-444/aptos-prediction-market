/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF2FF',
          100: '#E0EAFF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#7C91F9',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E3A8A',
          900: '#172554',
        },
        secondary: {
          50: '#F3EEFF',
          100: '#E7DDFF',
          200: '#CFBBFF',
          300: '#B799FF',
          400: '#9F77FF',
          500: '#6B4CE6', // Deep Purple (PROPHECY brand)
          600: '#563DD9',
          700: '#412EB8',
          800: '#2C1F97',
          900: '#160F76',
        },
        accent: {
          50: '#E6FFFD',
          100: '#CCFFFB',
          200: '#99FFF7',
          300: '#66FFF3',
          400: '#33FFEF',
          500: '#00FFF0', // Neon Cyan (PROPHECY brand)
          600: '#00D4C9',
          700: '#00A99E',
          800: '#007F73',
          900: '#005548',
        },
        success: {
          50: '#E6FFF4',
          100: '#CCFFE9',
          200: '#99FFD4',
          300: '#66FFBE',
          400: '#33FFA9',
          500: '#00FF88', // Neon Green
          600: '#00D472',
          700: '#00A95C',
          800: '#007F46',
          900: '#005530',
        },
        warning: {
          50: '#FFFEE6',
          100: '#FFFCCC',
          200: '#FFF999',
          300: '#FFF666',
          400: '#FFF333',
          500: '#FFD600', // Bright Yellow
          600: '#D4B000',
          700: '#A98A00',
          800: '#7F6500',
          900: '#554000',
        },
        error: {
          50: '#FFE6F1',
          100: '#FFCCE3',
          200: '#FF99C7',
          300: '#FF66AB',
          400: '#FF338F',
          500: '#FF006E', // Hot Pink
          600: '#D4005C',
          700: '#A9004A',
          800: '#7F0038',
          900: '#550026',
        },
        dark: {
          DEFAULT: '#0A0E27',
          bg: '#0A0E27', // Dark Navy (PROPHECY brand)
          surface: '#141B3D',
          border: '#1F2847',
          50: '#E8E9F0',
          100: '#D1D4E1',
          200: '#A3A8C3',
          300: '#757DA5',
          400: '#475187',
          500: '#1F2847', // Border
          600: '#141B3D', // Surface
          700: '#0F1530',
          800: '#0A0E27', // Background
          900: '#050713',
        },
        // NEW: Tiki color palette for Move Market rebrand
        tiki: {
          turquoise: '#00CFC1',
          coral: '#FF6B6B',
          mango: '#FFB347',
          'deep-teal': '#0A5F5F',
          coconut: '#FFF8E7',
          volcano: '#E63946',
          lagoon: '#4ECDC4',
          sunset: '#F77F00',
          bamboo: '#90BE6D',
          charcoal: '#1A1A2E',
          driftwood: '#564D4D',
          sand: '#F4E9D8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Orbitron', 'Poppins', 'sans-serif'], // PROPHECY brand (legacy)
        baloo: ['"Baloo 2"', 'cursive'], // NEW: Tiki display font
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        // NEW: Tiki glows
        'glow': '0 0 20px rgba(0, 207, 193, 0.5)',
        'glow-coral': '0 0 20px rgba(255, 107, 107, 0.5)',
        'glow-mango': '0 0 15px rgba(255, 179, 71, 0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        // NEW: Tiki animations
        'spin-slow': 'spin 3s linear infinite',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'bounce-slow': 'bounce 2s infinite',
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        // NEW: Tiki keyframes
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 207, 193, 0.5)' },
          '50%': { boxShadow: '0 0 30px rgba(0, 207, 193, 0.8)' },
        },
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      height: {
        'screen-safe': 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
      },
      minHeight: {
        'screen-safe': 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
      },
    },
  },
  plugins: [],
  safelist: [
    'safe-top',
    'safe-bottom',
    'safe-left',
    'safe-right',
  ],
}
