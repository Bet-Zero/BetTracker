import React, { useState } from 'react';
import { useBets } from '../hooks/useBets';
import { useInputs } from '../hooks/useInputs';
import { Bet, BetResult, BetType, BetLeg } from '../types';
import { parseCsv } from '../services/csvParser';
import { classifyBet } from '../services/marketClassification';
import { AlertTriangle, CheckCircle2, Download, ChevronDown, ChevronRight } from '../components/icons';
import InputManagementSection from './InputManagementView';
import { loadState, STORAGE_VERSION } from '../services/persistence';

interface SettingsViewProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ theme, toggleTheme }) => {
  const { bets, clearBets, addBets } = useBets();
  const { sportsbooks } = useInputs();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isInputManagementOpen, setIsInputManagementOpen] = useState(false);
  
  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
        setCsvFile(file);
    } else {
        setCsvFile(null);
        if (file) {
            showNotification("Please select a valid .csv file.", 'error');
        }
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;

    setIsImporting(true);
    setNotification(null);
    
    try {
        const csvString = await csvFile.text();
        const parsedRows = parseCsv(csvString);

        const siteMap = new Map<string, string>();
        sportsbooks.forEach(book => {
            siteMap.set(book.abbreviation.toLowerCase(), book.name);
            siteMap.set(book.name.toLowerCase(), book.name);
        });

        const newBets: Bet[] = parsedRows.map((row, index) => {
            if (!row.date || !row.site || !row.sport || !row.name || !row.type) {
                throw new Error(`Row ${index + 2} is missing required text fields (Date, Site, Sport, Name, Type).`);
            }

            const bookName = siteMap.get(row.site.toLowerCase()) || row.site;
            const description = `${row.name} ${row.ou || ''} ${row.line || ''} ${row.type}`.replace(/\s+/g, ' ').trim();
            const betType: BetType = row.notes?.toLowerCase().includes('live') ? 'live' : 'single';
            const isLive = row.notes?.toLowerCase().includes('live') || false;
            
            let placedAtDate: Date;
            if (row.date.includes('/')) {
                const parts = row.date.split('/');
                placedAtDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
            } else {
                placedAtDate = new Date(row.date);
            }

            if (isNaN(placedAtDate.getTime())) {
                throw new Error(`Row ${index + 2}: Invalid date format for "${row.date}". Please use MM/DD/YYYY.`);
            }
            
            const placedAt = placedAtDate.toISOString();
            const betId = `csv-${placedAtDate.getTime()}-${index}`;
            const id = `${bookName}-${betId}`;

            // Don't create legs for single bets - store type, line, ou directly on bet
            const stake = row.bet;
            const profit = row.toWin;
            let payout: number;

            switch (row.result) {
                case 'win':
                    // Payout is the total return: stake + profit
                    payout = stake + profit;
                    break;
                case 'loss':
                    payout = 0;
                    break;
                case 'push':
                    // Payout for a push is just the stake back
                    payout = stake;
                    break;
                case 'pending':
                default:
                    // Pending bets have not paid out yet
                    payout = 0;
                    break;
            }

            const betData = {
                id,
                book: bookName,
                betId,
                placedAt,
                betType,
                sport: row.sport,
                description,
                name: row.name, // Store player/team name separately
                odds: row.odds,
                stake: stake,
                payout: payout,
                result: row.result,
                type: row.type, // Store stat type directly for single bets
                line: row.line, // Store line directly for single bets
                ou: row.ou, // Store Over/Under directly for single bets
                legs: undefined, // Single bets don't have legs
                tail: row.tail,
                raw: `Imported from CSV. Notes: ${row.notes || ''}`.trim(),
                isLive, // Set isLive from notes field
            };

            return {
                ...betData,
                marketCategory: classifyBet(betData)
            };
        });

        const importedCount = addBets(newBets);
        showNotification(`Successfully imported ${importedCount} new bets from CSV.`, 'success');

    } catch (error: any) {
        console.error("CSV Import failed:", error);
        showNotification(error.message || `An unexpected error occurred during import.`, 'error');
    } finally {
        setIsImporting(false);
        setCsvFile(null);
        const fileInput = document.getElementById('csv-importer') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
    }
  };

  const exportToCSV = () => {
    if (bets.length === 0) {
      alert("No bets to export.");
      return;
    }

    const headers = Object.keys(bets[0]).filter(key => key !== 'legs' && key !== 'raw');
    const csvRows = [headers.join(',')];

    bets.forEach(bet => {
      const values = headers.map(header => {
        let value = (bet as any)[header];
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `bettracker_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  /**
   * Export full persisted state as JSON backup.
   * This includes version info, metadata, and all bets with full leg data.
   * Useful for data recovery and migration.
   */
  const exportBackupJSON = () => {
    try {
      const result = loadState();
      
      if (!result.ok) {
        showNotification('Failed to load state for backup: ' + result.error.message, 'error');
        return;
      }
      
      const state = result.value;
      
      // Create a comprehensive backup object
      const backup = {
        exportedAt: new Date().toISOString(),
        version: STORAGE_VERSION,
        format: 'bettracker-backup-v1',
        stats: {
          totalBets: state.bets.length,
          lastUpdated: state.updatedAt,
        },
        state: state,
      };
      
      const jsonString = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        // Format: YYYY-MM-DD_HHmmss for filesystem-safe timestamp
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
        const timestamp = `${date}_${time}`;
        link.setAttribute('href', url);
        link.setAttribute('download', `bettracker_backup_${timestamp}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showNotification(`Backup exported: ${state.bets.length} bets saved.`, 'success');
      }
    } catch (error) {
      console.error('Export backup failed:', error);
      showNotification('Failed to export backup: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  };

  const handleClearDataClick = () => {
    setShowClearConfirm(true);
  };

  const handleClearDataConfirm = () => {
    if (!clearBets) {
      console.error("ERROR: clearBets is not defined!");
      alert("Error: clearBets function is not available. Check console for details.");
      setShowClearConfirm(false);
      return;
    }
    
    const betCountBefore = bets.length;
    
    try {
      clearBets();
      setShowClearConfirm(false);
      
      // Wait a moment then verify
      setTimeout(() => {
        const storedBets = localStorage.getItem("bettracker-bets");
        
        if (storedBets) {
          const remainingCount = JSON.parse(storedBets).length;
          console.error("ERROR: localStorage still contains bets after clear!", remainingCount);
          setNotification({ message: `Error: Failed to clear bets. ${remainingCount} bets still in storage.`, type: 'error' });
        } else {
          setNotification({ message: `Success! All ${betCountBefore} bet(s) have been cleared.`, type: 'success' });
        }
      }, 100);
    } catch (error) {
      console.error("Error calling clearBets:", error);
      setShowClearConfirm(false);
      setNotification({ message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    }
  };

  const handleClearDataCancel = () => {
    setShowClearConfirm(false);
  };

  const SettingCard: React.FC<{title: string, description: string, children: React.ReactNode}> = ({title, description, children}) => (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 flex justify-between items-center">
        <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{title}</h3>
            <p className="text-neutral-500 dark:text-neutral-400 mt-1">{description}</p>
        </div>
        <div>
            {children}
        </div>
    </div>
  );

  const CsvImportInstructions = () => (
    <details className="mt-4 text-sm text-left w-full">
        <summary className="cursor-pointer font-medium text-primary-500 hover:text-primary-400">View CSV format instructions</summary>
        <div className="mt-2 p-4 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg space-y-2 text-neutral-600 dark:text-neutral-300">
            <p>Your CSV file should match the format of common bet tracking spreadsheets.</p>
            <p><b>Required Header Row:</b></p>
            <code className="block text-xs bg-neutral-200 dark:bg-neutral-900 p-2 rounded">
              Date,Site,Sport,Type,Name,O/U,Line,Odds,Bet,To Win,Result,Net,Tail,Notes
            </code>
            <p><b>Notes:</b></p>
            <ul className="list-disc list-inside space-y-1 text-xs">
                <li>The header row is <b>required</b> and must match the names above. Column order does not matter.</li>
                <li><b>Date:</b> Should be a recognizable format, like <code>MM/DD/YYYY</code>.</li>
                <li><b>Site:</b> Use abbreviations (e.g., FD, DK). These will be mapped to the full names you've configured in Input Management.</li>
                <li><b>Result:</b> Must contain 'Won', 'Lost', or 'Push'.</li>
                <li><b>Bet & To Win:</b> Can include '$' signs; they will be removed automatically.</li>
                <li><b>Notes:</b> If this column contains the word "Live", the bet will be marked as a live bet.</li>
                <li>The <code>Net</code> column is ignored and will be recalculated by the app.</li>
                <li>Each row is imported as a single bet. Parlays are not supported via this CSV import method yet.</li>
            </ul>
        </div>
    </details>
  );

  const NotificationBanner = () => {
    if (!notification) return null;
    
    const colors = {
      success: 'bg-accent-900/50 border-accent-700 text-accent-300',
      error: 'bg-danger-900/50 border-danger-700 text-danger-300',
    };
    const Icon = notification.type === 'success' ? CheckCircle2 : AlertTriangle;

    return (
      <div className={`fixed top-8 right-8 z-50 p-4 rounded-lg border flex items-center space-x-3 shadow-lg transition-transform animate-pulse ${colors[notification.type]}`}>
        <Icon className="w-6 h-6" />
        <span className="font-medium">{notification.message}</span>
      </div>
    );
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-6 bg-neutral-100 dark:bg-neutral-950 overflow-y-auto">
      {NotificationBanner()}
      <header>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Settings</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">Manage your application data and preferences.</p>
      </header>
      
      <div className="space-y-4">
        <SettingCard title="Appearance" description="Toggle between light and dark themes.">
            <button
                onClick={toggleTheme}
                className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600"
            >
                Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
            </button>
        </SettingCard>
      </div>

      <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800">
        <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">Data Management</h2>
         <div className="space-y-4 mt-4">
            <SettingCard title="Import from CSV" description="Bulk import your bet history from a formatted CSV file.">
                <div className="flex flex-col items-end space-y-4 w-96">
                    <input 
                        id="csv-importer"
                        type="file" 
                        accept=".csv"
                        onChange={handleFileChange}
                        className="w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 dark:file:bg-primary-900/50 file:text-primary-700 dark:file:text-primary-300 hover:file:bg-primary-100 dark:hover:file:bg-primary-900"
                    />
                    <button
                        onClick={handleCsvImport}
                        disabled={!csvFile || isImporting}
                        className="w-full px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg shadow-md hover:bg-primary-700 disabled:bg-neutral-600 disabled:cursor-not-allowed"
                    >
                        {isImporting ? 'Importing...' : 'Import from CSV'}
                    </button>
                    <CsvImportInstructions />
                </div>
            </SettingCard>
            <SettingCard title="Export All Data" description="Download your entire bet history as a single CSV file.">
                <button
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg shadow-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-75"
                >
                    Export All Bets to CSV
                </button>
            </SettingCard>
            <SettingCard title="Export Full Backup (JSON)" description="Download a complete backup including all bet data, leg details, and metadata. Use this for data recovery.">
<button
    onClick={exportBackupJSON}
    type="button"
    className="px-4 py-2 bg-neutral-600 dark:bg-neutral-700 text-white font-semibold rounded-lg shadow-md hover:bg-neutral-700 dark:hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-opacity-75 flex items-center gap-2"
>
    <Download className="w-4 h-4" />
    Export JSON Backup
</button>
            </SettingCard>
          </div>
      </div>

      <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setIsInputManagementOpen(!isInputManagementOpen)}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-md hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
        >
          <div>
            <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">Input Management</h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-1">Customize the entities used for tracking and filtering throughout the app.</p>
          </div>
          <div className="ml-4 flex-shrink-0">
            {isInputManagementOpen ? (
              <ChevronDown className="w-6 h-6 text-neutral-500 dark:text-neutral-400" />
            ) : (
              <ChevronRight className="w-6 h-6 text-neutral-500 dark:text-neutral-400" />
            )}
          </div>
        </button>
        {isInputManagementOpen && (
          <div className="mt-4">
            <InputManagementSection />
          </div>
        )}
      </div>

      <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800">
        <h2 className="text-2xl font-bold text-danger-700 dark:text-danger-500">Danger Zone</h2>
         <div className="space-y-4 mt-4">
            <SettingCard title="Clear All Data" description="Permanently delete all imported bets from the application. This cannot be undone.">
                 <button
                    onClick={handleClearDataClick}
                    className="px-4 py-2 bg-danger-600 text-white font-semibold rounded-lg shadow-md hover:bg-danger-700 focus:outline-none focus:ring-2 focus:ring-danger-500 focus:ring-opacity-75"
                >
                    Clear All Bet Data
                </button>
            </SettingCard>
          </div>
      </div>
      
      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold text-danger-600 dark:text-danger-500 mb-4">
              ⚠️ Warning: Delete All Bet Data?
            </h3>
            <p className="text-neutral-700 dark:text-neutral-300 mb-6">
              This will permanently delete <strong>ALL {bets.length} bet(s)</strong> from your account.
              <br /><br />
              This action <strong>cannot be undone</strong>.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleClearDataCancel}
                className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              >
                Cancel
              </button>
              <button
                onClick={handleClearDataConfirm}
                className="px-4 py-2 bg-danger-600 text-white font-semibold rounded-lg hover:bg-danger-700 focus:outline-none focus:ring-2 focus:ring-danger-500"
              >
                Yes, Delete All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="pt-6 border-t border-neutral-200 dark:border-neutral-800 text-center text-sm text-neutral-500 dark:text-neutral-400">
        <a
          href="https://github.com/Bet-Zero/BetTracker/blob/main/PRIVACY.md"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary-500 underline"
        >
          Privacy Policy
        </a>
        {' | '}
        <a
          href="https://github.com/Bet-Zero/BetTracker/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary-500 underline"
        >
          License
        </a>
      </footer>
    </div>
  );
};

export default SettingsView;