import { processPage } from "../parsing/pageProcessor";
import { PageSourceProvider } from "./pageSourceProvider";
import { SportsbookName, Bet } from "../types";
import { convertFinalRowToBet } from "../parsing/convertFinalRowToBet";

/**
 * Parses HTML and returns bets without importing them.
 * Used for confirmation menu.
 */
export async function parseBets(
  book: SportsbookName,
  provider: PageSourceProvider
): Promise<Bet[]> {
  const rawHtml = await provider.getPageSource(book);

  // Parse HTML to FinalRow[] (normalized format)
  const finalRows = processPage(book, rawHtml);

  // Convert FinalRow[] to Bet[] for internal storage
  const parsedBets: Bet[] = finalRows.map(convertFinalRowToBet);

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

  // Parse HTML to FinalRow[] (normalized format)
  const finalRows = processPage(book, rawHtml);

  // Convert FinalRow[] to Bet[] for internal storage
  const parsedBets: Bet[] = finalRows.map(convertFinalRowToBet);

  const importedCount = addBets(parsedBets);

  return { foundCount: parsedBets.length, importedCount };
}
