import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="theme-toggle">
      <button
        className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
        onClick={() => setTheme('light')}
        title="Light mode"
        aria-label="Light mode"
      >
        <Sun size={14} />
      </button>
      <button
        className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
        onClick={() => setTheme('dark')}
        title="Dark mode"
        aria-label="Dark mode"
      >
        <Moon size={14} />
      </button>
      <button
        className={`theme-toggle-btn ${theme === 'system' ? 'active' : ''}`}
        onClick={() => setTheme('system')}
        title="System theme"
        aria-label="System theme"
      >
        <Monitor size={14} />
      </button>
    </div>
  );
};
