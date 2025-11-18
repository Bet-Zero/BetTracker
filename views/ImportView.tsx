import React, { useState } from 'react';
import { useBets } from '../hooks/useBets';
import { useInputs } from '../hooks/useInputs';
import { SportsbookName } from '../types';
import { AlertTriangle, CheckCircle2, ExternalLink } from '../components/icons';
import { ManualPasteSourceProvider } from '../services/pageSourceProvider';
import { handleImport } from '../services/importer';
import { NoSourceDataError } from '../services/errors';

const ImportView: React.FC = () => {
  const { addBets } = useBets();
  const { sportsbooks } = useInputs();
  const [selectedBook, setSelectedBook] = useState<SportsbookName>(sportsbooks[0]?.name || '');
  const [pageHtml, setPageHtml] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const selectedBookUrl = sportsbooks.find(b => b.name === selectedBook)?.url || 'https://google.com/search?q=sportsbooks';

  const handleImportClick = async () => {
    if (!selectedBook) {
        showNotification('Please select a sportsbook first.', 'error');
        return;
    }
    setIsImporting(true);
    setNotification(null);

    const sourceProvider = new ManualPasteSourceProvider(() => pageHtml);
    
    try {
      const { foundCount, importedCount } = await handleImport(selectedBook, sourceProvider, addBets);

      if (foundCount > 0) {
        if (importedCount > 0) {
          showNotification(`Imported ${importedCount} new bets out of ${foundCount} found.`, 'success');
        } else {
          showNotification(`Found ${foundCount} bets, but none were new.`, 'info');
        }
      } else {
        showNotification(`Could not find any bets to import. Check the source or parser.`, 'error');
      }
      setPageHtml('');
    } catch (error) {
      if (error instanceof NoSourceDataError) {
        showNotification(error.message, 'error');
      } else {
        console.error("Import failed:", error);
        showNotification(`An unexpected error occurred during import. Check console for details.`, 'error');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'info' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };
  
  const NotificationBanner = () => {
    if (!notification) return null;
    
    const colors = {
      success: 'bg-accent-900/50 border-accent-700 text-accent-300',
      info: 'bg-primary-900/50 border-primary-700 text-primary-300',
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
    <div className="p-6 h-full flex flex-col space-y-4 bg-neutral-100 dark:bg-neutral-950">
      {NotificationBanner()}
      <header className="flex-shrink-0">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Import Bets</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">Navigate to your bet history and paste the page source to import.</p>
      </header>
      
      <div className="flex-shrink-0 p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <label htmlFor="sportsbook-select" className="font-medium text-neutral-700 dark:text-neutral-300">Sportsbook:</label>
          <select
            id="sportsbook-select"
            value={selectedBook}
            onChange={(e) => setSelectedBook(e.target.value as SportsbookName)}
            className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5"
            disabled={isImporting}
          >
            {sportsbooks.map((book) => (
              <option key={book.name} value={book.name}>{book.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleImportClick}
          disabled={isImporting || !pageHtml}
          className="px-6 py-2.5 bg-primary-600 text-white font-semibold rounded-lg shadow-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-75 transition-transform transform hover:scale-105 disabled:bg-neutral-600 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed"
        >
          {isImporting ? 'Importing...' : 'Import Bets From Source'}
        </button>
      </div>

      <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        <div className="flex flex-col bg-white dark:bg-neutral-900 rounded-lg shadow-md">
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Browser View</h2>
                 <a href={selectedBookUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-1 bg-neutral-100 dark:bg-neutral-700 text-xs font-medium rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-600">
                    Open in New Tab <ExternalLink className="w-3 h-3 ml-1.5" />
                </a>
            </div>
            <div className="p-2 bg-yellow-400/10 border-b border-yellow-400/20">
                <p className="text-xs text-yellow-800 dark:text-yellow-300 text-center">
                    <b>Note:</b> Most sites block being embedded for security. This view is a placeholder for the real desktop app.
                </p>
            </div>
            <iframe
                key={selectedBook}
                src={selectedBookUrl}
                className="w-full flex-grow border-0"
                title={`${selectedBook} Browser`}
                sandbox="allow-scripts allow-same-origin"
            ></iframe>
        </div>

        <div className="flex flex-col bg-white dark:bg-neutral-900 rounded-lg shadow-md">
           <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-semibold">Paste Page Source Here</h2>
          </div>
          <textarea
            value={pageHtml}
            onChange={(e) => setPageHtml(e.target.value)}
            placeholder={`1. Navigate to your ${selectedBook} settled bets page.\n2. Right-click -> View Page Source.\n3. Copy everything (Ctrl+A, Ctrl+C).\n4. Paste it here (Ctrl+V).`}
            className="w-full flex-grow p-4 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono text-xs leading-relaxed"
            disabled={isImporting}
          ></textarea>
        </div>
      </div>
    </div>
  );
};

export default ImportView;
