import { BetResult, LegResult } from "../../../types";

// DEBUG toggle
export const DK_DEBUG = true;
export const dkDebug = (...args: any[]) => {
  if (!DK_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log("[DK-DEBUG]", ...args);
};

export interface FooterMeta {
  stake: number | null;
  payout: number | null;
  result: BetResult | null;
}

export interface HeaderInfo {
  betId: string;
  placedAt: string;
}

/* -------------------------------------------------------------------------- */
/*                                EXTRACTORS                                  */
/* -------------------------------------------------------------------------- */

/**
 * Extract Bet ID and Date from the header area
 */
export const extractHeaderInfo = (element: Element): HeaderInfo => {
  // Date: span[data-test-id^="bet-reference-"][data-test-id$="-0"]
  // "Nov 18, 2025, 11:11:19 PM"
  const dateEl = element.querySelector('span[data-test-id^="bet-reference-"][data-test-id$="-0"]');
  const dateStr = dateEl?.textContent ? normalizeSpaces(dateEl.textContent) : '';
  
  // Bet ID: span[data-test-id^="bet-reference-"][data-test-id$="-1"]
  // "DK638991222795551269"
  const idEl = element.querySelector('span[data-test-id^="bet-reference-"][data-test-id$="-1"]');
  let betId = idEl?.textContent ? normalizeSpaces(idEl.textContent) : '';
  
  let placedAt = dateStr;
  try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
          placedAt = d.toISOString();
      }
  } catch (e) {
      dkDebug('Failed to parse date', dateStr);
  }

  return { betId, placedAt };
};

/**
 * Extract Stake, Payout, and Result from the footer area
 */
export const extractFooterMeta = (element: Element): FooterMeta => {
  // Stake: span[data-test-id^="bet-stake-"] -> "Wager: $1.00"
  const stakeEl = element.querySelector('span[data-test-id^="bet-stake-"]');
  const stakeText = stakeEl?.textContent || '';
  const stake = parseMoney(stakeText);

  // Return: span[data-test-id^="bet-returns-"] -> "Paid: $1.89"
  const payoutEl = element.querySelector('span[data-test-id^="bet-returns-"]');
  const payoutText = payoutEl?.textContent || '';
  const payout = parseMoney(payoutText);

  // Result: div[data-test-id^="bet-details-status-"] -> "Won"
  const statusEl = element.querySelector('div[data-test-id^="bet-details-status-"]');
  const statusText = statusEl?.textContent?.toLowerCase().trim() || '';

  let result: BetResult = 'pending';
  if (statusText === 'won') result = 'win';
  else if (statusText === 'lost') result = 'loss';
  else if (statusText === 'void') result = 'push';

  return { stake, payout, result };
};

/* -------------------------------------------------------------------------- */
/*                                UTILS                                       */
/* -------------------------------------------------------------------------- */

export const parseMoney = (raw: string): number | null => {
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
};

export const normalizeSpaces = (text: string): string =>
  (text || "").replace(/\s+/g, " ").trim();
