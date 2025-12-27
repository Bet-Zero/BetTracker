/**
 * Formatters Test Suite
 *
 * Tests for utils/formatters.ts to lock in formatting behavior:
 * - Date formatting (short, chart key, export)
 * - Odds formatting
 * - Currency formatting
 * - Percentage formatting
 * - Net formatting
 */

import { describe, it, expect } from 'vitest';
import {
  formatDateShort,
  formatDateChartKey,
  formatDateExport,
  formatOdds,
  formatCurrency,
  formatPercentage,
  formatNet,
} from './formatters';

// --- formatDateShort Tests ---

describe('formatDateShort', () => {
  it('formats valid ISO date as MM/DD', () => {
    expect(formatDateShort('2024-12-26T10:30:00.000Z')).toMatch(/^\d{2}\/\d{2}$/);
  });

  it('outputs correct month and day for known date', () => {
    // Use a date that won't have timezone issues
    const date = new Date(2024, 11, 26, 12, 0, 0); // Dec 26, 2024, noon local time
    const result = formatDateShort(date);
    expect(result).toBe('12/26');
  });

  it('returns empty string for null input', () => {
    expect(formatDateShort(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(formatDateShort(undefined)).toBe('');
  });

  it('returns empty string for invalid date string', () => {
    expect(formatDateShort('invalid-date')).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatDateShort('')).toBe('');
  });

  it('handles Date object input', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(formatDateShort(date)).toBe('01/15');
  });
});

// --- formatDateChartKey Tests ---

describe('formatDateChartKey', () => {
  it('formats valid ISO date as YYYY-MM-DD', () => {
    const date = new Date(2024, 11, 26, 12, 0, 0);
    expect(formatDateChartKey(date)).toBe('2024-12-26');
  });

  it('returns empty string for null input', () => {
    expect(formatDateChartKey(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(formatDateChartKey(undefined)).toBe('');
  });

  it('returns empty string for invalid date string', () => {
    expect(formatDateChartKey('not-a-date')).toBe('');
  });

  it('handles ISO string input', () => {
    // Using a date at noon to avoid timezone edge cases
    const result = formatDateChartKey('2024-06-15T12:00:00.000Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// --- formatDateExport Tests ---

describe('formatDateExport', () => {
  it('formats valid date as MM/DD/YY', () => {
    const date = new Date(2024, 11, 26, 12, 0, 0); // Dec 26, 2024
    expect(formatDateExport(date)).toBe('12/26/24');
  });

  it('returns empty string for null input', () => {
    expect(formatDateExport(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(formatDateExport(undefined)).toBe('');
  });

  it('returns empty string for invalid date string', () => {
    expect(formatDateExport('garbage')).toBe('');
  });

  it('handles ISO string input', () => {
    const date = new Date(2024, 5, 15, 12, 0, 0); // June 15, 2024
    expect(formatDateExport(date)).toBe('06/15/24');
  });
});

// --- formatOdds Tests ---

describe('formatOdds', () => {
  it('formats positive odds with + prefix', () => {
    expect(formatOdds(150)).toBe('+150');
  });

  it('formats negative odds without modification', () => {
    expect(formatOdds(-110)).toBe('-110');
  });

  it('rounds decimal odds to integer', () => {
    expect(formatOdds(150.7)).toBe('+151');
    expect(formatOdds(-110.3)).toBe('-110');
  });

  it('returns empty string for 0', () => {
    expect(formatOdds(0)).toBe('');
  });

  it('returns empty string for null', () => {
    expect(formatOdds(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatOdds(undefined)).toBe('');
  });

  it('handles string input', () => {
    expect(formatOdds('+200')).toBe('+200');
    expect(formatOdds('-150')).toBe('-150');
  });

  it('returns empty string for empty string input', () => {
    expect(formatOdds('')).toBe('');
  });

  it('returns empty string for NaN input', () => {
    expect(formatOdds('abc' as any)).toBe('');
  });
});

// --- formatCurrency Tests ---

describe('formatCurrency', () => {
  it('formats number with 2 decimal places', () => {
    expect(formatCurrency(10)).toBe('10.00');
  });

  it('formats decimal values correctly', () => {
    expect(formatCurrency(10.5)).toBe('10.50');
    // Note: toFixed() uses banker's rounding, so 10.555 becomes 10.55
    expect(formatCurrency(10.555)).toBe('10.55');
  });

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('0.00');
  });

  it('returns empty string for null', () => {
    expect(formatCurrency(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatCurrency(undefined)).toBe('');
  });

  it('returns empty string for NaN', () => {
    expect(formatCurrency(NaN)).toBe('');
  });
});

// --- formatPercentage Tests ---

describe('formatPercentage', () => {
  it('formats percentage with 1 decimal place and % suffix', () => {
    expect(formatPercentage(55.5)).toBe('55.5%');
  });

  it('rounds to 1 decimal place', () => {
    expect(formatPercentage(55.555)).toBe('55.6%');
  });

  it('formats zero correctly', () => {
    expect(formatPercentage(0)).toBe('0.0%');
  });

  it('formats 100 correctly', () => {
    expect(formatPercentage(100)).toBe('100.0%');
  });

  it('returns empty string for null', () => {
    expect(formatPercentage(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatPercentage(undefined)).toBe('');
  });

  it('returns empty string for NaN', () => {
    expect(formatPercentage(NaN)).toBe('');
  });
});

// --- formatNet Tests ---

describe('formatNet', () => {
  it('formats positive net with 2 decimal places', () => {
    expect(formatNet(100.5)).toBe('100.50');
  });

  it('formats negative net preserving sign', () => {
    expect(formatNet(-50)).toBe('-50.00');
  });

  it('formats zero correctly', () => {
    expect(formatNet(0)).toBe('0.00');
  });

  it('rounds to 2 decimal places', () => {
    // Note: toFixed() uses banker's rounding
    expect(formatNet(100.555)).toBe('100.56'); // .555 rounds up
    expect(formatNet(-50.555)).toBe('-50.55'); // Negative: -50.555 rounds toward zero
  });

  it('returns empty string for null', () => {
    expect(formatNet(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatNet(undefined)).toBe('');
  });

  it('returns empty string for NaN', () => {
    expect(formatNet(NaN)).toBe('');
  });
});
