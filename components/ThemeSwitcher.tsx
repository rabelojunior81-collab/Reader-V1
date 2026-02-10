import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { SunIcon, MoonIcon, SystemIcon } from './Icons';

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const options = [
    { name: 'light', icon: <SunIcon className="w-5 h-5" />, label: 'Tema Claro' },
    { name: 'dark', icon: <MoonIcon className="w-5 h-5" />, label: 'Tema Escuro' },
    { name: 'system', icon: <SystemIcon className="w-5 h-5" />, label: 'Tema do Sistema' },
  ] as const;

  return (
    <div className="flex items-center p-1 bg-zinc-200 dark:bg-zinc-800 rounded-md">
      {options.map((option) => (
        <button
          key={option.name}
          onClick={() => setTheme(option.name)}
          className={`p-1.5 rounded-md transition-colors duration-200 ${
            theme === option.name
              ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-500'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
          title={option.label}
          aria-pressed={theme === option.name}
          aria-label={option.label}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
};