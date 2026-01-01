import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeType = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: ThemeType;
  effectiveTheme: 'dark' | 'light';
  setTheme: (theme: ThemeType) => void;
  initTheme: () => void;
}

const getSystemTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (theme: 'dark' | 'light') => {
  document.documentElement.setAttribute('data-theme', theme);
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      effectiveTheme: getSystemTheme(),

      setTheme: (theme: ThemeType) => {
        const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
        set({ theme, effectiveTheme });
        applyTheme(effectiveTheme);
      },

      initTheme: () => {
        const { theme } = get();
        const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
        set({ effectiveTheme });
        applyTheme(effectiveTheme);

        // Listen for system theme changes
        if (typeof window !== 'undefined') {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          const handleChange = (e: MediaQueryListEvent) => {
            const { theme } = get();
            if (theme === 'system') {
              const newEffectiveTheme = e.matches ? 'dark' : 'light';
              set({ effectiveTheme: newEffectiveTheme });
              applyTheme(newEffectiveTheme);
            }
          };

          mediaQuery.addEventListener('change', handleChange);

          // Return cleanup function
          return () => {
            mediaQuery.removeEventListener('change', handleChange);
          };
        }
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
