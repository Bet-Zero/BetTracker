import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import {
  PredictionMarket,
  PredictionPosition,
  PredictionTrade,
  PredictionPositionMetrics,
} from '../types';
import {
  getMarkets,
  setMarkets,
  getPositions,
  setPositions,
  getTrades,
  setTrades,
  getTradesForPosition,
  getMarketById,
  calculatePositionMetrics,
  sortMarketsByUpdated,
  sortPositionsByMarketAndOutcome,
  generateId,
} from '../services/predictionMarketsStore';

// ================================
// Types
// ================================

export interface ComputedPosition {
  market: PredictionMarket;
  position: PredictionPosition;
  metrics: PredictionPositionMetrics;
  trades: PredictionTrade[];
}

interface PredictionMarketsContextType {
  // Raw data
  markets: PredictionMarket[];
  positions: PredictionPosition[];
  trades: PredictionTrade[];
  loading: boolean;

  // Computed data
  computedPositions: ComputedPosition[];

  // Market CRUD
  addMarket: (market: Omit<PredictionMarket, 'id' | 'createdAtIso' | 'updatedAtIso'>) => PredictionMarket;
  updateMarket: (id: string, updates: Partial<PredictionMarket>) => void;
  deleteMarket: (id: string) => void;

  // Position CRUD
  addPosition: (position: Omit<PredictionPosition, 'id' | 'createdAtIso' | 'updatedAtIso'>) => PredictionPosition;
  updatePosition: (id: string, updates: Partial<PredictionPosition>) => void;
  deletePosition: (id: string) => void;

  // Trade CRUD
  addTrade: (trade: Omit<PredictionTrade, 'id'>) => PredictionTrade;
  updateTrade: (id: string, updates: Partial<PredictionTrade>) => void;
  deleteTrade: (id: string) => void;

  // Selectors
  getTradesForPosition: (positionId: string) => PredictionTrade[];
  getMarketForPosition: (marketId: string) => PredictionMarket | undefined;
  getPositionsForMarket: (marketId: string) => PredictionPosition[];
}

const PredictionMarketsContext = createContext<PredictionMarketsContextType | undefined>(undefined);

// ================================
// Provider
// ================================

export const PredictionMarketsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [markets, setMarketsState] = useState<PredictionMarket[]>([]);
  const [positions, setPositionsState] = useState<PredictionPosition[]>([]);
  const [trades, setTradesState] = useState<PredictionTrade[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      setMarketsState(getMarkets());
      setPositionsState(getPositions());
      setTradesState(getTrades());
    } catch (error) {
      console.error('[usePredictionMarkets] Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ================================
  // Computed Positions
  // ================================

  const computedPositions = useMemo((): ComputedPosition[] => {
    const sortedPositions = sortPositionsByMarketAndOutcome(positions, markets);
    
    return sortedPositions.map(position => {
      const market = markets.find(m => m.id === position.marketId);
      const positionTrades = trades
        .filter(t => t.positionId === position.id)
        .sort((a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime());
      
      const metrics = calculatePositionMetrics(
        positionTrades,
        position.lastKnownPrice,
        market
      );

      return {
        market: market || {
          id: position.marketId,
          platform: 'Unknown',
          title: 'Unknown Market',
          status: 'open' as const,
          createdAtIso: new Date().toISOString(),
          updatedAtIso: new Date().toISOString(),
        },
        position,
        metrics,
        trades: positionTrades,
      };
    });
  }, [markets, positions, trades]);

  // ================================
  // Market CRUD
  // ================================

  const addMarketAction = useCallback(
    (marketData: Omit<PredictionMarket, 'id' | 'createdAtIso' | 'updatedAtIso'>): PredictionMarket => {
      const now = new Date().toISOString();
      const newMarket: PredictionMarket = {
        ...marketData,
        id: generateId(),
        createdAtIso: now,
        updatedAtIso: now,
      };

      setMarketsState(prev => {
        const updated = [...prev, newMarket];
        setMarkets(updated);
        return updated;
      });

      return newMarket;
    },
    []
  );

  const updateMarketAction = useCallback((id: string, updates: Partial<PredictionMarket>) => {
    setMarketsState(prev => {
      const index = prev.findIndex(m => m.id === id);
      if (index === -1) return prev;

      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        ...updates,
        updatedAtIso: new Date().toISOString(),
      };
      setMarkets(updated);
      return updated;
    });
  }, []);

  const deleteMarketAction = useCallback((id: string) => {
    // Get positions for this market
    const positionsToDelete = positions.filter(p => p.marketId === id);
    const positionIds = new Set(positionsToDelete.map(p => p.id));

    // Remove trades for these positions
    setTradesState(prev => {
      const updated = prev.filter(t => !positionIds.has(t.positionId));
      setTrades(updated);
      return updated;
    });

    // Remove positions for this market
    setPositionsState(prev => {
      const updated = prev.filter(p => p.marketId !== id);
      setPositions(updated);
      return updated;
    });

    // Remove market
    setMarketsState(prev => {
      const updated = prev.filter(m => m.id !== id);
      setMarkets(updated);
      return updated;
    });
  }, [positions]);

  // ================================
  // Position CRUD
  // ================================

  const addPositionAction = useCallback(
    (positionData: Omit<PredictionPosition, 'id' | 'createdAtIso' | 'updatedAtIso'>): PredictionPosition => {
      const now = new Date().toISOString();
      const newPosition: PredictionPosition = {
        ...positionData,
        id: generateId(),
        createdAtIso: now,
        updatedAtIso: now,
      };

      setPositionsState(prev => {
        const updated = [...prev, newPosition];
        setPositions(updated);
        return updated;
      });

      return newPosition;
    },
    []
  );

  const updatePositionAction = useCallback((id: string, updates: Partial<PredictionPosition>) => {
    setPositionsState(prev => {
      const index = prev.findIndex(p => p.id === id);
      if (index === -1) return prev;

      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        ...updates,
        updatedAtIso: new Date().toISOString(),
      };
      setPositions(updated);
      return updated;
    });
  }, []);

  const deletePositionAction = useCallback((id: string) => {
    // Remove trades for this position
    setTradesState(prev => {
      const updated = prev.filter(t => t.positionId !== id);
      setTrades(updated);
      return updated;
    });

    // Remove position
    setPositionsState(prev => {
      const updated = prev.filter(p => p.id !== id);
      setPositions(updated);
      return updated;
    });
  }, []);

  // ================================
  // Trade CRUD
  // ================================

  const addTradeAction = useCallback(
    (tradeData: Omit<PredictionTrade, 'id'>): PredictionTrade => {
      const newTrade: PredictionTrade = {
        ...tradeData,
        id: generateId(),
      };

      setTradesState(prev => {
        const updated = [...prev, newTrade];
        setTrades(updated);
        return updated;
      });

      return newTrade;
    },
    []
  );

  const updateTradeAction = useCallback((id: string, updates: Partial<PredictionTrade>) => {
    setTradesState(prev => {
      const index = prev.findIndex(t => t.id === id);
      if (index === -1) return prev;

      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        ...updates,
      };
      setTrades(updated);
      return updated;
    });
  }, []);

  const deleteTradeAction = useCallback((id: string) => {
    setTradesState(prev => {
      const updated = prev.filter(t => t.id !== id);
      setTrades(updated);
      return updated;
    });
  }, []);

  // ================================
  // Selectors
  // ================================

  const getTradesForPositionSelector = useCallback(
    (positionId: string): PredictionTrade[] => {
      return trades
        .filter(t => t.positionId === positionId)
        .sort((a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime());
    },
    [trades]
  );

  const getMarketForPositionSelector = useCallback(
    (marketId: string): PredictionMarket | undefined => {
      return markets.find(m => m.id === marketId);
    },
    [markets]
  );

  const getPositionsForMarketSelector = useCallback(
    (marketId: string): PredictionPosition[] => {
      return positions.filter(p => p.marketId === marketId);
    },
    [positions]
  );

  return (
    <PredictionMarketsContext.Provider
      value={{
        markets,
        positions,
        trades,
        loading,
        computedPositions,
        addMarket: addMarketAction,
        updateMarket: updateMarketAction,
        deleteMarket: deleteMarketAction,
        addPosition: addPositionAction,
        updatePosition: updatePositionAction,
        deletePosition: deletePositionAction,
        addTrade: addTradeAction,
        updateTrade: updateTradeAction,
        deleteTrade: deleteTradeAction,
        getTradesForPosition: getTradesForPositionSelector,
        getMarketForPosition: getMarketForPositionSelector,
        getPositionsForMarket: getPositionsForMarketSelector,
      }}
    >
      {children}
    </PredictionMarketsContext.Provider>
  );
};

// ================================
// Hook
// ================================

export const usePredictionMarkets = (): PredictionMarketsContextType => {
  const context = useContext(PredictionMarketsContext);
  if (context === undefined) {
    throw new Error('usePredictionMarkets must be used within a PredictionMarketsProvider');
  }
  return context;
};
