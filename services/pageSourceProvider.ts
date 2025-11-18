import { SportsbookName } from '../types';
import { NoSourceDataError } from './errors';

/**
 * An abstraction for providing the HTML source of a sportsbook page.
 * This allows swapping between manual pasting and a live webview.
 */
export interface PageSourceProvider {
  /**
   * Retrieves the page source for a given sportsbook.
   * @param book The sportsbook to get the source for.
   * @returns A promise that resolves to the page's HTML source as a string.
   */
  getPageSource(book: SportsbookName): Promise<string>;
}

/**
 * A PageSourceProvider that gets its content from a user-populated textarea.
 * This is used in the web-based Gemini environment.
 */
export class ManualPasteSourceProvider implements PageSourceProvider {
  /**
   * @param getTextareaValue A function that returns the current value of the HTML source textarea.
   */
  constructor(private getTextareaValue: () => string) {}

  async getPageSource(book: SportsbookName): Promise<string> {
    const value = this.getTextareaValue();
    if (!value || !value.trim()) {
        throw new NoSourceDataError("Please paste the page's HTML source into the text area before importing.");
    }
    return Promise.resolve(value);
  }
}

/**
 * A PageSourceProvider that interacts with an embedded webview.
 * This is the target implementation for a real desktop app (e.g., Electron, Tauri).
 */
// TODO: When this project is moved to Electron or Tauri,
// replace ManualPasteSourceProvider with this real implementation.
export class WebviewSourceProvider implements PageSourceProvider {
  /**
   * @param webview An instance of the webview controller from the desktop framework.
   */
  constructor(private webview: any) {}

  async getPageSource(book: SportsbookName): Promise<string> {
    // In the desktop version, this will run code inside a real browser view:
    // This example gets the innerHTML, but you could get outerHTML for full parsing.
    // return await this.webview.executeJavaScript('document.body.innerHTML');
    console.error("WebviewSourceProvider is not implemented in the Gemini environment.", book, this.webview);
    throw new Error("WebviewSourceProvider is not implemented in the Gemini environment.");
  }
}
