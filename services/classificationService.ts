import { Bet, MarketCategory } from '../types';

// Omit fields that are not available during classification of a new bet object.
type ClassifiableBet = Omit<Bet, 'id' | 'marketCategory' | 'raw' | 'tail'>;

const isProp = (bet: ClassifiableBet): boolean => {
    // Check legs for player/team props
    // FIX: The 'BetLeg' type does not have a 'player' property. Use 'entities' to check for player/team props.
    if (bet.legs?.some(leg => leg.entities && leg.entities.length > 0)) {
        return true;
    }
    // Check description for common prop keywords
    const propKeywords = [
        'Pts', 'Reb', 'Ast', // NBA
        'Points', 'Rebounds', 'Assists', 'Threes', // General
        'Yards', 'Touchdown', 'TD', 'Receiving', 'Rushing', 'Passing', // NFL
        'Home Runs', 'Strikeouts', 'Hits', 'Runs', // MLB
        'Goals', 'Shots on Goal', // NHL / Soccer
    ];
    if (propKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(bet.description))) {
        return true;
    }
    return false;
};

const isMainMarket = (bet: ClassifiableBet): boolean => {
    const mainMarketKeywords = ['Moneyline', 'ML', 'Spread'];
    if (mainMarketKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(bet.description))) {
        return true;
    }
    // Check for spread patterns like -7.5 or +3.5 at the end of the description
    if (/[+-]\d{1,3}(\.5)?$/.test(bet.description.trim())) {
        return true;
    }
     // Check for totals patterns
    if (/\b(Total|Over|Under)\b/i.test(bet.description)) {
        return true;
    }
    return false;
};

const isFuture = (bet: ClassifiableBet): boolean => {
    const futureKeywords = ['to win', 'Award', 'MVP', 'Champion', 'Outright', 'Win Total'];
    if (futureKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(bet.description))) {
        return true;
    }
    return false;
};

export const classifyBet = (bet: ClassifiableBet): MarketCategory => {
    if (bet.betType === 'sgp') {
        return 'SGP/SGP+';
    }
    if (bet.betType === 'parlay') {
        return 'Parlays';
    }

    if (isFuture(bet)) {
        return 'Futures';
    }
    
    // For single/live bets, check for market type
    if (['single', 'live', 'other'].includes(bet.betType)) {
        if (isMainMarket(bet)) {
            return 'Main Markets';
        }
        if (isProp(bet)) {
            return 'Props';
        }
    }
    
    // Fallback for parlays/sgps that might be prop-heavy but not caught above
    if (isProp(bet)) {
        return 'Props';
    }

    return 'Other';
};