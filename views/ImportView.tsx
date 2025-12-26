import React, { useState } from 'react';
import { useBets } from '../hooks/useBets';
import { useInputs } from '../hooks/useInputs';
import { SportsbookName, Bet } from '../types';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader, Info, XCircle } from '../components/icons';
import { ManualPasteSourceProvider } from '../services/pageSourceProvider';
import { parseBetsResult } from '../services/importer';
import { ImportConfirmationModal, ImportSummary } from '../components/ImportConfirmationModal';

// Import flow state machine
type ImportState = 
  | 'idle'           // Ready to paste HTML
  | 'parsing'        // Currently parsing HTML
  | 'parsed'         // Successfully parsed, showing confirmation modal
  | 'importing'      // Currently importing to storage
  | 'error';         // Error state with message

interface ImportResult {
  importedCount: number;
  skippedDuplicates: number;
  blockedCount: number;
}

const ImportView: React.FC = () => {
  const { bets, addBets } = useBets();
  const { sportsbooks, sports, players, addPlayer, addSport } = useInputs();
  const [selectedBook, setSelectedBook] = useState<SportsbookName>(sportsbooks[0]?.name || '');
  const [pageHtml, setPageHtml] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [importState, setImportState] = useState<ImportState>('idle');
  const [parsedBets, setParsedBets] = useState<Bet[] | null>(null);
  const [lastImportResult, setLastImportResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  
  const selectedBookUrl = sportsbooks.find(b => b.name === selectedBook)?.url || 'https://google.com/search?q=sportsbooks';
import React, { useState, useMemo } from 'react';

  const handleParseClick = async () => {
    if (!selectedBook) {
        showNotification('Please select a sportsbook first.', 'error');
        return;
    }
    if (!pageHtml.trim()) {
        showNotification('Please paste the page source first.', 'error');
        return;
    }
    
    setImportState('parsing');
    setNotification(null);
    setParseError(null);

    const sourceProvider = new ManualPasteSourceProvider(() => pageHtml);
    
    const result = await parseBetsResult(selectedBook, sourceProvider);
    
    if (!result.ok) {
      // Display user-safe error message from ImportError
      const errorMsg = result.error.message;
      setParseError(errorMsg);
      setImportState('error');
      showNotification(errorMsg, 'error');
      return;
    }
    
    if (result.value.length === 0) {
      const noBetsMsg = 'No bets found in the pasted HTML. Make sure you copied the entire page source.';
      setParseError(noBetsMsg);
      setImportState('error');
      showNotification(noBetsMsg, 'error');
      return;
    }
    
    setParsedBets(result.value);
    setImportState('parsed');
    showNotification(`Found ${result.value.length} bet${result.value.length !== 1 ? 's' : ''} ready to review.`, 'success');
  };

  const handleConfirmImport = async (summary: ImportSummary) => {
    if (!parsedBets || parsedBets.length === 0) return;
    
    setImportState('importing');
    try {
      const importedCount = addBets(parsedBets);
      
      // Calculate actual import results
      const importResult: ImportResult = {
        importedCount,
        skippedDuplicates: summary.duplicates,
        blockedCount: summary.blockers,
      };
      
      setLastImportResult(importResult);
      
      // Build detailed success message
      let message = `Successfully imported ${importedCount} bet${importedCount !== 1 ? 's' : ''}.`;
      if (summary.duplicates > 0) {
        message += ` ${summary.duplicates} duplicate${summary.duplicates !== 1 ? 's' : ''} skipped.`;
      }
      
      showNotification(message, 'success');
      setPageHtml('');
      setParsedBets(null);
      setImportState('idle');
    } catch (error) {
      console.error("Import failed:", error);
      showNotification('Failed to save bets. Please try again.', 'error');
      setImportState('error');
    }
  };

  const handleCancelImport = () => {
    setParsedBets(null);
    setImportState('idle');
  };

  const handleEditBet = (index: number, updates: Partial<Bet>) => {
    if (!parsedBets) return;
    const updatedBets = [...parsedBets];
    updatedBets[index] = { ...updatedBets[index], ...updates };
    setParsedBets(updatedBets);
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
    const Icon = notification.type === 'success' ? CheckCircle2 : 
                 notification.type === 'info' ? Info : AlertTriangle;

    return (
      <div className={`fixed top-8 right-8 z-50 p-4 rounded-lg border flex items-center space-x-3 shadow-lg transition-transform animate-pulse ${colors[notification.type]}`}>
        <Icon className="w-6 h-6" />
        <span className="font-medium">{notification.message}</span>
      </div>
    );
  };
  
  // State status indicator for the import flow
  const StateIndicator = () => {
    const isProcessing = importState === 'parsing' || importState === 'importing';
    
    const getStateMessage = () => {
      switch (importState) {
        case 'idle':
          return pageHtml.trim() ? 'Ready to parse' : 'Paste page source to begin';
        case 'parsing':
          return 'Parsing HTML...';
        case 'parsed':
          return `${parsedBets?.length || 0} bets ready for review`;
        case 'importing':
          return 'Importing bets...';
        case 'error':
          return parseError || 'An error occurred';
        default:
          return '';
      }
    };
    
    const getStateColor = () => {
      switch (importState) {
        case 'idle':
          return pageHtml.trim() 
            ? 'text-primary-600 dark:text-primary-400'
            : 'text-neutral-500 dark:text-neutral-400';
        case 'parsing':
        case 'importing':
          return 'text-primary-600 dark:text-primary-400';
        case 'parsed':
          return 'text-accent-600 dark:text-accent-400';
        case 'error':
          return 'text-danger-600 dark:text-danger-400';
        default:
          return 'text-neutral-500';
      }
    };
    
    const getIcon = () => {
      switch (importState) {
        case 'parsing':
        case 'importing':
          return <Loader className="w-4 h-4 animate-spin" />;
        case 'parsed':
          return <CheckCircle2 className="w-4 h-4" />;
        case 'error':
          return <XCircle className="w-4 h-4" />;
        default:
          return null;
      }
    };
    
    return (
      <div className={`flex items-center gap-2 text-sm ${getStateColor()}`}>
        {getIcon()}
        <span>{getStateMessage()}</span>
      </div>
    );
  };

  const isProcessing = importState === 'parsing' || importState === 'importing';

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-neutral-100 dark:bg-neutral-950">
      {NotificationBanner()}
      {parsedBets && importState === 'parsed' && (
        <ImportConfirmationModal
          bets={parsedBets}
          existingBetIds={existingBetIds}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelImport}
          onEditBet={handleEditBet}
          availableSports={sports}
          availablePlayers={players}
          sportsbooks={sportsbooks}
          onAddPlayer={addPlayer}
          onAddSport={addSport}
        />
      )}
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
            disabled={isProcessing}
          >
            {sportsbooks.map((book) => (
              <option key={book.name} value={book.name}>{book.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <StateIndicator />
          <button
            onClick={handleParseClick}
            disabled={isProcessing || !pageHtml.trim()}
            className="px-6 py-2.5 bg-primary-600 text-white font-semibold rounded-lg shadow-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-75 transition-transform transform hover:scale-105 disabled:bg-neutral-600 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {importState === 'parsing' && <Loader className="w-4 h-4 animate-spin" />}
            {importState === 'parsing' ? 'Parsing...' : 'Parse & Review Bets'}
          </button>
        </div>
      </div>

      {/* Last import result summary */}
      {lastImportResult && importState === 'idle' && (
        <div className="flex-shrink-0 p-3 bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-accent-700 dark:text-accent-300">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Last import: <strong>{lastImportResult.importedCount}</strong> imported
              {lastImportResult.skippedDuplicates > 0 && (
                <>, <strong>{lastImportResult.skippedDuplicates}</strong> duplicates skipped</>
              )}
              {lastImportResult.blockedCount > 0 && (
                <>, <strong>{lastImportResult.blockedCount}</strong> blocked</>
              )}
            </span>
          </div>
        </div>
      )}

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
           <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Paste Page Source Here</h2>
            {pageHtml.trim() && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {pageHtml.length.toLocaleString()} characters
              </span>
            )}
          </div>
          
          {/* Parse error display */}
          {importState === 'error' && parseError && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border-b border-danger-200 dark:border-danger-800">
              <div className="flex items-start gap-2 text-sm text-danger-700 dark:text-danger-300">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Parse Error</p>
                  <p className="text-xs mt-1">{parseError}</p>
                </div>
              </div>
            </div>
          )}
          
          <textarea
            value={pageHtml}
            onChange={(e) => {
              setPageHtml(e.target.value);
              // Reset error state when user starts typing
              if (importState === 'error') {
                setImportState('idle');
                setParseError(null);
              }
            }}
            placeholder={`1. Navigate to your ${selectedBook} settled bets page.\n2. Right-click -> View Page Source.\n3. Copy everything (Ctrl+A, Ctrl+C).\n4. Paste it here (Ctrl+V).`}
            className="w-full flex-grow p-4 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono text-xs leading-relaxed"
            disabled={isProcessing}
          ></textarea>
        </div>
      </div>
    </div>
  );
};

export default ImportView;
