/**
 * @deprecated This file is being replaced by services/marketClassification.ts
 * This file now re-exports the new unified classification service.
 * It is kept temporarily for backwards compatibility during migration.
 */

import { Bet, MarketCategory } from '../types';
import { classifyBet as classifyBetUnified } from './marketClassification';
import { initializeLookupMaps } from './normalizationServiceDynamic';

// Omit fields that are not available during classification of a new bet object.
type ClassifiableBet = Omit<Bet, 'id' | 'marketCategory' | 'raw' | 'tail'>;

/**
 * Classifies a bet's market category.
 * @deprecated Use classifyBet from './marketClassification' directly
 */
export const classifyBet = (bet: ClassifiableBet): MarketCategory => {
    // Ensure normalization data is loaded (kept for backwards compatibility)
    initializeLookupMaps();
    
    // Delegate to unified classification service
    return classifyBetUnified(bet);
};
