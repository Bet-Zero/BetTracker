/**
 * Importer V2 - Simplified Architecture
 * 
 * Direct flow: HTML → Bet (via pageProcessor)
 * No intermediate transformations.
 */

import { processPage } from "../parsing/pageProcessor";
import { PageSourceProvider } from "./pageSourceProvider";
import { SportsbookName, Bet } from "../types";

/**
 * Parses HTML and returns bets without importing them.
 * Used for confirmation menu.
 */
export async function parseBets(
  book: SportsbookName,
  provider: PageSourceProvider
): Promise<Bet[]> {
  const rawHtml = await provider.getPageSource(book);

  // Parse HTML directly to Bet[]
  const parsedBets: Bet[] = processPage(book, rawHtml);

  return parsedBets;
}

/**
 * Orchestrates the import process: get source -> parse -> add to storage.
 * @param book The sportsbook being imported.
 * @param provider The PageSourceProvider to use for getting HTML.
 * @param addBets The function from useBets context to add bets and persist them.
 * @returns A promise that resolves to the number of bets found and newly imported.
 */
export async function handleImport(
  book: SportsbookName,
  provider: PageSourceProvider,
  addBets: (newBets: Bet[]) => number
): Promise<{ foundCount: number; importedCount: number }> {
  const rawHtml = await provider.getPageSource(book);

  // Parse HTML directly to Bet[]
  const parsedBets: Bet[] = processPage(book, rawHtml);

  const importedCount = addBets(parsedBets);

  return { foundCount: parsedBets.length, importedCount };
}
