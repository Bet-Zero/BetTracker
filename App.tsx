import React, { useState, useEffect } from 'react';
import { BetsProvider } from './hooks/useBets';
import { InputsProvider } from './hooks/useInputs';
import { NormalizationDataProvider } from './hooks/useNormalizationData';
import ImportView from './views/ImportView';
import BetTableView from './views/BetTableView';
import DashboardView from './views/DashboardView';
import SettingsView from './views/SettingsView';
import SportsbookBreakdownView from './views/SportsbookBreakdownView';
import BySportView from './views/BySportView';
import PlayerProfileView from './views/PlayerProfileView';
import ParlayPerformanceView from './views/ParlayPerformanceView';
import ErrorBoundary from './components/ErrorBoundary';
import { DownloadCloud, BarChart2, Settings, Table, Sun, Moon, Scale, User, Trophy, Layers } from './components/icons';

type Tab = 'import' | 'table' | 'dashboard' | 'bySport' | 'sportsbooks' | 'player' | 'parlays' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('import');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('bettracker-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
    }
    // Default to dark theme
    return 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('bettracker-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'import':
        return <ImportView />;
      case 'table':
        return <BetTableView />;
      case 'dashboard':
        return <DashboardView />;
      case 'bySport':
        return <BySportView />;
      case 'sportsbooks':
        return <SportsbookBreakdownView />;
      case 'player':
        return <PlayerProfileView selectedPlayer={selectedPlayer} setSelectedPlayer={setSelectedPlayer} />;
      case 'parlays':
        return <ParlayPerformanceView />;
      case 'settings':
        return <SettingsView theme={theme} toggleTheme={toggleTheme} />;
      default:
        return <ImportView />;
    }
  };

  const NavItem: React.FC<{ tab: Tab; icon: React.ReactNode; label: string }> = ({ tab, icon, label }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg w-full text-left transition-colors duration-200 ${
        activeTab === tab
          ? 'bg-primary-600 text-white shadow-lg'
          : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800/50'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <NormalizationDataProvider>
      <InputsProvider>
        <BetsProvider>
          <div className="flex h-screen bg-neutral-100 dark:bg-neutral-950 font-sans">
          <aside className="w-64 flex-shrink-0 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col p-4">
            <div className="flex items-center space-x-2 px-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <BarChart2 className="w-8 h-8 text-primary-500" />
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">BetTracker</h1>
            </div>
            <nav className="mt-6 flex-grow space-y-2">
              <NavItem tab="import" icon={<DownloadCloud className="w-6 h-6" />} label="Import Bets" />
              <NavItem tab="table" icon={<Table className="w-6 h-6" />} label="Bet Table" />
              <NavItem tab="dashboard" icon={<BarChart2 className="w-6 h-6" />} label="Dashboard" />
              <NavItem tab="bySport" icon={<Trophy className="w-6 h-6" />} label="By Sport" />
              <NavItem tab="sportsbooks" icon={<Scale className="w-6 h-6" />} label="By Sportsbook" />
              <NavItem tab="parlays" icon={<Layers className="w-6 h-6" />} label="Parlays" />
              <NavItem tab="player" icon={<User className="w-6 h-6" />} label="Player Profiles" />
              <NavItem tab="settings" icon={<Settings className="w-6 h-6" />} label="Settings" />
            </nav>
            <div className="mt-auto p-4">
               <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
              </button>
            </div>
          </aside>
          <main className="flex-1 overflow-y-auto">
            <ErrorBoundary>
              {renderTab()}
            </ErrorBoundary>
          </main>
          </div>
        </BetsProvider>
      </InputsProvider>
    </NormalizationDataProvider>
  );
};

export default App;