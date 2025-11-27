import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

const LIGHT_THEME = 'light';
const DARK_THEME = 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

const getInitialTheme = (): Theme => {
  // SSR compatibility - check if window is available
  if (typeof window === 'undefined') {
    return LIGHT_THEME;
  }

  // Check localStorage first
  const savedTheme = localStorage.getItem('theme') as Theme | null;
  if (savedTheme === LIGHT_THEME || savedTheme === DARK_THEME) {
    return savedTheme;
  }

  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return DARK_THEME;
  }

  return LIGHT_THEME;
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    // SSR compatibility
    if (typeof window === 'undefined') {
      return;
    }

    const root = window.document.documentElement;

    // Remove old theme class
    root.classList.remove(LIGHT_THEME, DARK_THEME);

    // Add new theme class
    root.classList.add(theme);

    // Save to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prevTheme => prevTheme === LIGHT_THEME ? DARK_THEME : LIGHT_THEME);
  };

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
