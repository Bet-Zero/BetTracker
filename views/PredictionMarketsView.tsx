import React, { useState, useMemo } from 'react';
import {
  usePredictionMarkets,
  ComputedPosition,
} from '../hooks/usePredictionMarkets';
import {
  PredictionMarket,
  PredictionPosition,
  PredictionTrade,
  PredictionTradeSide,
  PredictionMarketStatus,
} from '../types';
import {
  Plus,
  X,
  Edit2,
  Trash2,
  Check,
  TrendingUp,
  ChevronRight,
} from '../components/icons';

type TabId = 'positions' | 'trades';

type ModalType = 
  | 'addMarket' 
  | 'addPosition' 
  | 'addTrade' 
  | 'editPosition' 
  | 'positionDetails'
  | null;

interface ModalState {
  type: ModalType;
  data?: {
    position?: ComputedPosition;
    marketId?: string;
    positionId?: string;
  };
}

const COMMON_PLATFORMS = ['Kalshi', 'Polymarket', 'PredictIt', 'Metaculus'];

function formatCurrency(value: number | undefined, decimals = 2): string {
  if (value === undefined || value === null) return '-';
  return value.toFixed(decimals);
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getPnlColorClass(value: number | undefined): string {
  if (value === undefined || value === null) return '';
  if (value > 0) return 'text-accent-600 dark:text-accent-400';
  if (value < 0) return 'text-danger-600 dark:text-danger-400';
  return '';
}

const PredictionMarketsView: React.FC = () => {
  const {
    markets,
    positions,
    trades,
    computedPositions,
    loading,
    addMarket,
    updateMarket,
    deleteMarket,
    addPosition,
    updatePosition,
    deletePosition,
    addTrade,
    updateTrade,
    deleteTrade,
  } = usePredictionMarkets();

  const [activeTab, setActiveTab] = useState<TabId>('positions');
  const [modal, setModal] = useState<ModalState>({ type: null });

  const flatTradeLog = useMemo(() => {
    return trades
      .map(trade => {
        const position = positions.find(p => p.id === trade.positionId);
        const market = position ? markets.find(m => m.id === position.marketId) : undefined;
        return { trade, position, market };
      })
      .sort((a, b) => new Date(b.trade.dateIso).getTime() - new Date(a.trade.dateIso).getTime());
  }, [trades, positions, markets]);

  const openModal = (type: ModalType, data?: ModalState['data']) => {
    setModal({ type, data });
  };

  const closeModal = () => {
    setModal({ type: null });
  };

  const TabButton: React.FC<{ id: TabId; label: string }> = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
        activeTab === id
          ? 'bg-white dark:bg-neutral-900 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
      }`}
    >
      {label}
    </button>
  );

  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-950">
        <div className="text-neutral-500 dark:text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col bg-neutral-100 dark:bg-neutral-950">
      <header className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-primary-500" />
              Prediction Markets
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 mt-1">
              Track your Kalshi, Polymarket, and other prediction market positions.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openModal('addMarket')}
              className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg shadow hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Market
            </button>
            <button
              onClick={() => openModal('addPosition')}
              className="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-medium rounded-lg shadow hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
              disabled={markets.length === 0}
              title={markets.length === 0 ? 'Create a market first' : ''}
            >
              <Plus className="w-4 h-4" />
              Add Position
            </button>
          </div>
        </div>
      </header>

      <div className="flex-shrink-0 flex gap-2 border-b border-neutral-200 dark:border-neutral-800">
        <TabButton id="positions" label="Positions" />
        <TabButton id="trades" label="Trade Log" />
      </div>

      <div className="flex-grow overflow-auto mt-4">
        {activeTab === 'positions' && (
          <PositionsTable
            computedPositions={computedPositions}
            onRowClick={(pos) => openModal('positionDetails', { position: pos })}
          />
        )}
        {activeTab === 'trades' && (
          <TradeLogTable tradeLog={flatTradeLog} />
        )}
      </div>

      {modal.type === 'addMarket' && (
        <AddMarketModal
          onClose={closeModal}
          onSave={(data) => {
            addMarket(data);
            closeModal();
          }}
        />
      )}

      {modal.type === 'addPosition' && (
        <AddPositionModal
          markets={markets}
          onClose={closeModal}
          onSave={(data) => {
            addPosition(data);
            closeModal();
          }}
        />
      )}

      {modal.type === 'addTrade' && modal.data?.positionId && (
        <AddTradeModal
          positionId={modal.data.positionId}
          onClose={closeModal}
          onSave={(data) => {
            addTrade(data);
            closeModal();
          }}
        />
      )}

      {modal.type === 'positionDetails' && modal.data?.position && (
        <PositionDetailsDrawer
          computedPosition={modal.data.position}
          onClose={closeModal}
          onAddTrade={() => openModal('addTrade', { positionId: modal.data!.position!.position.id })}
          onUpdatePosition={(updates) => {
            updatePosition(modal.data!.position!.position.id, updates);
          }}
          onUpdateMarket={(updates) => {
            updateMarket(modal.data!.position!.market.id, updates);
          }}
          onDeleteTrade={deleteTrade}
        />
      )}
    </div>
  );
};


interface PositionsTableProps {
  computedPositions: ComputedPosition[];
  onRowClick: (pos: ComputedPosition) => void;
}

const PositionsTable: React.FC<PositionsTableProps> = ({
  computedPositions,
  onRowClick,
}) => {
  if (computedPositions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 dark:text-neutral-400">
        <TrendingUp className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">No positions yet</p>
        <p className="text-sm mt-1">Add a market and position to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Platform</th>
            <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Market Title</th>
            <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Outcome</th>
            <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Status</th>
            <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Shares</th>
            <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Avg Entry</th>
            <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Cost Basis</th>
            <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Last Price</th>
            <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Est. Value</th>
            <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Realized P/L</th>
            <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Final P/L</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {computedPositions.map((cp) => (
            <tr
              key={cp.position.id}
              onClick={() => onRowClick(cp)}
              className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 text-neutral-700 dark:text-neutral-200">{cp.market.platform}</td>
              <td className="px-4 py-3 text-neutral-900 dark:text-white font-medium max-w-xs truncate" title={cp.market.title}>
                {cp.market.title}
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  cp.position.outcome === 'YES' 
                    ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300'
                    : cp.position.outcome === 'NO'
                    ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}>
                  {cp.position.outcome}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  cp.market.status === 'open'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : cp.market.status === 'resolved'
                    ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}>
                  {cp.market.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-neutral-700 dark:text-neutral-200">
                {formatCurrency(cp.metrics.sharesHeld, 0)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-neutral-700 dark:text-neutral-200">
                {formatCurrency(cp.metrics.avgEntryPrice, 4)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-neutral-700 dark:text-neutral-200">
                ${formatCurrency(cp.metrics.costBasisHeld)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-neutral-500 dark:text-neutral-400">
                {cp.position.lastKnownPrice !== undefined ? formatCurrency(cp.position.lastKnownPrice, 4) : '-'}
              </td>
              <td className="px-4 py-3 text-right font-mono text-neutral-700 dark:text-neutral-200">
                {cp.metrics.estValue !== undefined ? `$${formatCurrency(cp.metrics.estValue)}` : '-'}
              </td>
              <td className={`px-4 py-3 text-right font-mono ${getPnlColorClass(cp.metrics.realizedPnl)}`}>
                ${formatCurrency(cp.metrics.realizedPnl)}
              </td>
              <td className={`px-4 py-3 text-right font-mono ${getPnlColorClass(cp.metrics.finalPnl)}`}>
                {cp.metrics.finalPnl !== undefined ? `$${formatCurrency(cp.metrics.finalPnl)}` : '-'}
              </td>
              <td className="px-4 py-3 text-right">
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface TradeLogEntry {
  trade: PredictionTrade;
  position?: PredictionPosition;
  market?: PredictionMarket;
}

interface TradeLogTableProps {
  tradeLog: TradeLogEntry[];
}

const TradeLogTable: React.FC<TradeLogTableProps> = ({ tradeLog }) => {
  if (tradeLog.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 dark:text-neutral-400">
        <TrendingUp className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">No trades yet</p>
        <p className="text-sm mt-1">Trades will appear here once you add them.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Date</th>
            <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Platform</th>
            <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Market</th>
            <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Outcome</th>
            <th className="text-center px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Side</th>
            <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Shares</th>
            <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Price</th>
            <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Fee</th>
            <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300">Total</th>
          </tr>
        </thead>
        <tbody>
          {tradeLog.map(({ trade, position, market }) => {
            const total = trade.shares * trade.price;
            return (
              <tr
                key={trade.id}
                className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
              >
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {formatDate(trade.dateIso)}
                </td>
                <td className="px-4 py-3 text-neutral-700 dark:text-neutral-200">
                  {market?.platform || '-'}
                </td>
                <td className="px-4 py-3 text-neutral-900 dark:text-white max-w-xs truncate" title={market?.title}>
                  {market?.title || '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    position?.outcome === 'YES' 
                      ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300'
                      : position?.outcome === 'NO'
                      ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}>
                    {position?.outcome || '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    trade.side === 'BUY'
                      ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300'
                      : 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'
                  }`}>
                    {trade.side}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-neutral-700 dark:text-neutral-200">
                  {trade.shares}
                </td>
                <td className="px-4 py-3 text-right font-mono text-neutral-700 dark:text-neutral-200">
                  {formatCurrency(trade.price, 4)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-neutral-500 dark:text-neutral-400">
                  {trade.fee ? `$${formatCurrency(trade.fee)}` : '-'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-neutral-700 dark:text-neutral-200">
                  ${formatCurrency(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};


interface AddMarketModalProps {
  onClose: () => void;
  onSave: (data: Omit<PredictionMarket, 'id' | 'createdAtIso' | 'updatedAtIso'>) => void;
}

const AddMarketModal: React.FC<AddMarketModalProps> = ({ onClose, onSave }) => {
  const [platform, setPlatform] = useState('Kalshi');
  const [customPlatform, setCustomPlatform] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!title.trim()) return;
    const finalPlatform = platform === 'Other' ? customPlatform.trim() : platform;
    if (!finalPlatform) return;
    onSave({
      platform: finalPlatform,
      title: title.trim(),
      status: 'open',
      notes: notes.trim() || undefined,
    });
  };

  return (
    <ModalWrapper onClose={onClose} title="Add Market">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white"
          >
            {COMMON_PLATFORMS.map(p => (<option key={p} value={p}>{p}</option>))}
            <option value="Other">Other...</option>
          </select>
          {platform === 'Other' && (
            <input
              type="text"
              value={customPlatform}
              onChange={(e) => setCustomPlatform(e.target.value)}
              placeholder="Enter platform name"
              className="mt-2 w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white"
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Market Title / Question</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Will Bitcoin reach $100k by 2025?"
            className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={onClose} className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || (platform === 'Other' && !customPlatform.trim())}
            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >Add Market</button>
        </div>
      </div>
    </ModalWrapper>
  );
};

interface AddPositionModalProps {
  markets: PredictionMarket[];
  onClose: () => void;
  onSave: (data: Omit<PredictionPosition, 'id' | 'createdAtIso' | 'updatedAtIso'>) => void;
}

const AddPositionModal: React.FC<AddPositionModalProps> = ({ markets, onClose, onSave }) => {
  const [marketId, setMarketId] = useState(markets[0]?.id || '');
  const [outcome, setOutcome] = useState('YES');
  const [customOutcome, setCustomOutcome] = useState('');
  const [lastKnownPrice, setLastKnownPrice] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!marketId) return;
    const finalOutcome = outcome === 'Other' ? customOutcome.trim() : outcome;
    if (!finalOutcome) return;
    onSave({
      marketId,
      outcome: finalOutcome,
      lastKnownPrice: lastKnownPrice ? parseFloat(lastKnownPrice) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <ModalWrapper onClose={onClose} title="Add Position">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Market</label>
          <select
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white"
          >
            {markets.map(m => (<option key={m.id} value={m.id}>{m.platform} - {m.title}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Outcome</label>
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setOutcome('YES')} className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${outcome === 'YES' ? 'bg-accent-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}>YES</button>
            <button type="button" onClick={() => setOutcome('NO')} className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${outcome === 'NO' ? 'bg-danger-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}>NO</button>
            <button type="button" onClick={() => setOutcome('Other')} className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${outcome === 'Other' ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}>Other</button>
          </div>
          {outcome === 'Other' && (
            <input type="text" value={customOutcome} onChange={(e) => setCustomOutcome(e.target.value)} placeholder="Enter custom outcome" className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white" />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Last Known Price (optional)</label>
          <input type="number" step="0.0001" min="0" max="1" value={lastKnownPrice} onChange={(e) => setLastKnownPrice(e.target.value)} placeholder="e.g., 0.65" className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white" />
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Enter a value between 0 and 1 (e.g., 0.65 = 65 cents)</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white resize-none" />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={onClose} className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200">Cancel</button>
          <button onClick={handleSave} disabled={!marketId || (outcome === 'Other' && !customOutcome.trim())} className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">Add Position</button>
        </div>
      </div>
    </ModalWrapper>
  );
};


interface AddTradeModalProps {
  positionId: string;
  onClose: () => void;
  onSave: (data: Omit<PredictionTrade, 'id'>) => void;
}

const AddTradeModal: React.FC<AddTradeModalProps> = ({ positionId, onClose, onSave }) => {
  const [dateIso, setDateIso] = useState(new Date().toISOString().split('T')[0]);
  const [side, setSide] = useState<PredictionTradeSide>('BUY');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    const sharesNum = parseFloat(shares);
    const priceNum = parseFloat(price);
    if (isNaN(sharesNum) || sharesNum <= 0) return;
    if (isNaN(priceNum) || priceNum < 0) return;
    onSave({
      positionId,
      dateIso: new Date(dateIso).toISOString(),
      side,
      shares: sharesNum,
      price: priceNum,
      fee: fee ? parseFloat(fee) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <ModalWrapper onClose={onClose} title="Add Trade">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Date</label>
          <input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Side</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSide('BUY')} className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${side === 'BUY' ? 'bg-accent-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}>BUY</button>
            <button type="button" onClick={() => setSide('SELL')} className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${side === 'SELL' ? 'bg-danger-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}>SELL</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Shares</label>
            <input type="number" step="1" min="1" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="e.g., 100" className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Price per Share</label>
            <input type="number" step="0.0001" min="0" max="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g., 0.55" className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Fee (optional)</label>
          <input type="number" step="0.01" min="0" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="e.g., 0.50" className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white resize-none" />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={onClose} className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200">Cancel</button>
          <button onClick={handleSave} disabled={!shares || !price || parseFloat(shares) <= 0} className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">Add Trade</button>
        </div>
      </div>
    </ModalWrapper>
  );
};


interface PositionDetailsDrawerProps {
  computedPosition: ComputedPosition;
  onClose: () => void;
  onAddTrade: () => void;
  onUpdatePosition: (updates: Partial<PredictionPosition>) => void;
  onUpdateMarket: (updates: Partial<PredictionMarket>) => void;
  onDeleteTrade: (id: string) => void;
}

const PositionDetailsDrawer: React.FC<PositionDetailsDrawerProps> = ({
  computedPosition,
  onClose,
  onAddTrade,
  onUpdatePosition,
  onUpdateMarket,
  onDeleteTrade,
}) => {
  const { market, position, metrics, trades } = computedPosition;
  const [editingLastPrice, setEditingLastPrice] = useState(false);
  const [lastPriceValue, setLastPriceValue] = useState(position.lastKnownPrice?.toString() || '');
  const [editingStatus, setEditingStatus] = useState(false);

  const handleSaveLastPrice = () => {
    const value = lastPriceValue.trim() ? parseFloat(lastPriceValue) : undefined;
    onUpdatePosition({ lastKnownPrice: value });
    setEditingLastPrice(false);
  };

  const handleStatusChange = (status: PredictionMarketStatus, resolvedPrice?: 0 | 1) => {
    onUpdateMarket({ status, resolvedPrice });
    setEditingStatus(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-grow bg-black/50" onClick={onClose} />
      <div className="w-full max-w-lg bg-white dark:bg-neutral-900 shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Position Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <div className="p-4 space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">Market</h3>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Platform</span>
                <span className="font-medium text-neutral-900 dark:text-white">{market.platform}</span>
              </div>
              <div>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Title</span>
                <p className="font-medium text-neutral-900 dark:text-white mt-1">{market.title}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Status</span>
                {editingStatus ? (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => handleStatusChange('open')} className={`px-2 py-1 text-xs rounded ${market.status === 'open' ? 'bg-primary-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700'}`}>Open</button>
                    <button onClick={() => handleStatusChange('resolved', 1)} className={`px-2 py-1 text-xs rounded ${market.status === 'resolved' && market.resolvedPrice === 1 ? 'bg-accent-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700'}`}>YES (1)</button>
                    <button onClick={() => handleStatusChange('resolved', 0)} className={`px-2 py-1 text-xs rounded ${market.status === 'resolved' && market.resolvedPrice === 0 ? 'bg-danger-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700'}`}>NO (0)</button>
                    <button onClick={() => handleStatusChange('closed')} className={`px-2 py-1 text-xs rounded ${market.status === 'closed' ? 'bg-neutral-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700'}`}>Closed</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingStatus(true)} className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${market.status === 'open' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : market.status === 'resolved' ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'}`}>
                      {market.status}{market.status === 'resolved' ? ` (${market.resolvedPrice})` : ''}
                    </span>
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">Position</h3>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Outcome</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${position.outcome === 'YES' ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300' : position.outcome === 'NO' ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'}`}>{position.outcome}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Last Known Price</span>
                {editingLastPrice ? (
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.0001" min="0" max="1" value={lastPriceValue} onChange={(e) => setLastPriceValue(e.target.value)} className="w-24 px-2 py-1 text-sm bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded" />
                    <button onClick={handleSaveLastPrice} className="p-1 text-accent-600 hover:bg-accent-100 dark:hover:bg-accent-900/30 rounded"><Check className="w-4 h-4" /></button>
                    <button onClick={() => { setEditingLastPrice(false); setLastPriceValue(position.lastKnownPrice?.toString() || ''); }} className="p-1 text-danger-600 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button onClick={() => setEditingLastPrice(true)} className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline">
                    {position.lastKnownPrice !== undefined ? formatCurrency(position.lastKnownPrice, 4) : 'Not set'}
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              {position.notes && (<div><span className="text-sm text-neutral-500 dark:text-neutral-400">Notes</span><p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1">{position.notes}</p></div>)}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">Metrics</h3>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Shares Held" value={formatCurrency(metrics.sharesHeld, 0)} />
              <MetricCard label="Avg Entry" value={formatCurrency(metrics.avgEntryPrice, 4)} />
              <MetricCard label="Cost Basis" value={`$${formatCurrency(metrics.costBasisHeld)}`} />
              <MetricCard label="Total Fees" value={`$${formatCurrency(metrics.totalFees)}`} />
              <MetricCard label="Est. Value" value={metrics.estValue !== undefined ? `$${formatCurrency(metrics.estValue)}` : '-'} />
              <MetricCard label="Unrealized P/L" value={metrics.estUnrealizedPnl !== undefined ? `$${formatCurrency(metrics.estUnrealizedPnl)}` : '-'} colorClass={getPnlColorClass(metrics.estUnrealizedPnl)} />
              <MetricCard label="Realized P/L" value={`$${formatCurrency(metrics.realizedPnl)}`} colorClass={getPnlColorClass(metrics.realizedPnl)} />
              <MetricCard label="Final P/L" value={metrics.finalPnl !== undefined ? `$${formatCurrency(metrics.finalPnl)}` : '-'} colorClass={getPnlColorClass(metrics.finalPnl)} />
            </div>
          </section>
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Trades</h3>
              <button onClick={onAddTrade} className="flex items-center gap-1 px-3 py-1 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                <Plus className="w-4 h-4" />Add Trade
              </button>
            </div>
            {trades.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">No trades yet. Add a trade to track your position.</p>
            ) : (
              <div className="space-y-2">
                {trades.map(trade => (
                  <div key={trade.id} className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${trade.side === 'BUY' ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300' : 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'}`}>{trade.side}</span>
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{trade.shares} @ {formatCurrency(trade.price, 4)}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{formatDate(trade.dateIso)}{trade.fee ? ` - Fee: $${formatCurrency(trade.fee)}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-neutral-700 dark:text-neutral-200">${formatCurrency(trade.shares * trade.price)}</span>
                      <button onClick={() => onDeleteTrade(trade.id)} className="p-1 text-danger-600 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded" title="Delete trade"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};


interface MetricCardProps {
  label: string;
  value: string;
  colorClass?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, colorClass = '' }) => (
  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">
    <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
    <p className={`text-lg font-mono font-semibold ${colorClass || 'text-neutral-900 dark:text-white'}`}>{value}</p>
  </div>
);

interface ModalWrapperProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50" onClick={onClose} />
    <div className="relative bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{title}</h2>
        <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
          <X className="w-5 h-5 text-neutral-500" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default PredictionMarketsView;
