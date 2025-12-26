/**
 * Importer V2 - Simplified Architecture
 * 
 * Direct flow: HTML → Bet (via pageProcessor)
 * Uses Result<T> pattern for consistent error handling.
 */

import { processPage, processPageResult } from "../parsing/shared/pageProcessor";
import { PageSourceProvider } from "./pageSourceProvider";
import { SportsbookName, Bet } from "../types";
import { Result, ImportError, ok, err, createImportError, getErrorMessage } from "./errors";

/**
 * Result type for parseBets operation.
 */
export type ParseBetsResult = Result<Bet[]>;

/**
 * Parses HTML and returns bets using Result pattern.
 * Used for confirmation menu - does not import, just parses.
 * 
 * @param book - The sportsbook name
 * @param provider - Source provider for getting HTML
 * @returns Result<Bet[]> with either parsed bets or an ImportError
 */
export async function parseBetsResult(
  book: SportsbookName,
  provider: PageSourceProvider
): Promise<ParseBetsResult> {
  let rawHtml: string;
  
  try {
    rawHtml = await provider.getPageSource(book);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    return err(createImportError(
      'SOURCE_UNAVAILABLE',
      getErrorMessage('SOURCE_UNAVAILABLE'),
      `${book}: ${details}`
    ));
  }

  return processPageResult(book, rawHtml);
}

/**
 * Legacy parseBets function for backward compatibility.
 * Throws errors instead of returning Result.
 * 
 * @deprecated Use parseBetsResult for new code.
 * @throws Error if parsing fails with a descriptive message
 */
export async function parseBets(
  book: SportsbookName,
  provider: PageSourceProvider
): Promise<Bet[]> {
  const rawHtml = await provider.getPageSource(book);

  // Parse HTML directly to Bet[]
  const result = processPage(book, rawHtml);

  if (result.error) {
    throw new Error(result.error);
  }

  return result.bets;
}

/**
 * Result type for handleImport operation.
 */
export interface ImportResult {
  foundCount: number;
  importedCount: number;
}

/**
 * Orchestrates the import process using Result pattern.
 * Flow: get source -> parse -> add to storage.
 * 
 * @param book - The sportsbook being imported
 * @param provider - The PageSourceProvider to use for getting HTML
 * @param addBets - The function from useBets context to add bets and persist them
 * @returns Result with found/imported counts or an ImportError
 */
export async function handleImportResult(
  book: SportsbookName,
  provider: PageSourceProvider,
  addBets: (newBets: Bet[]) => number
): Promise<Result<ImportResult>> {
  const parseResult = await parseBetsResult(book, provider);
  
  if (!parseResult.ok) {
    return parseResult;
  }

  const bets = parseResult.value;
  
  try {
    const importedCount = addBets(bets);
    return ok({ foundCount: bets.length, importedCount });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    return err(createImportError(
      'STORAGE_FAILED',
      getErrorMessage('STORAGE_FAILED'),
      details
    ));
  }
}

/**
 * Legacy handleImport function for backward compatibility.
 * 
 * @deprecated Use handleImportResult for new code.
 * @throws Error if parsing fails with a descriptive message
 */
export async function handleImport(
  book: SportsbookName,
  provider: PageSourceProvider,
  addBets: (newBets: Bet[]) => number
): Promise<{ foundCount: number; importedCount: number }> {
  const rawHtml = await provider.getPageSource(book);

  // Parse HTML directly to Bet[]
  const result = processPage(book, rawHtml);

  if (result.error) {
    throw new Error(result.error);
  }

  const importedCount = addBets(result.bets);

  return { foundCount: result.bets.length, importedCount };
}
