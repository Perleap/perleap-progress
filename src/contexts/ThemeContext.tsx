/**
 * Theme Provider Context
 * Provides dark mode functionality using next-themes
 */

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';

export const ThemeProvider = ({ children, ...props }: ThemeProviderProps) => {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
};
