import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export const THEME_KEY = 'sx_theme';
const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
});

export function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => (
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : readStoredTheme()
  ));

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore private-mode storage errors */
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
