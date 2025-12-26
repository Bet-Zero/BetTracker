/**
 * Import Pipeline Error Handling
 * 
 * This module provides a consistent Result type and ImportError model
 * used across the entire import pipeline:
 * - pageProcessor
 * - importer.parseBets
 * - FanDuel/DraftKings parsers
 * - storage boundary
 * - confirmation modal
 * 
 * Rules:
 * - Return Result<T> for expected failures (empty HTML, no bets found, validation failures)
 * - Only throw for truly unexpected programming errors
 * - Use ImportError.code for programmatic handling
 * - Use ImportError.message for user-safe display
 * - Use ImportError.details for developer debugging
 */

/**
 * Error codes for import pipeline failures.
 * Used for programmatic error handling and consistent UI messaging.
 */
export type ImportErrorCode =
  | 'EMPTY_HTML'           // HTML content is empty or whitespace-only
  | 'INPUT_TOO_LARGE'      // Input exceeds max allowed size (security/performance guardrail)
  | 'NO_BETS_FOUND'        // Parser ran but found no bets
  | 'PARSER_FAILED'        // Parser threw an unexpected error
  | 'PARSER_NOT_AVAILABLE' // No parser exists for the sportsbook
  | 'VALIDATION_BLOCKED'   // Validation blockers prevent import
  | 'STORAGE_FAILED'       // Failed to write to localStorage
  | 'STORAGE_CORRUPTED'    // Storage data format is invalid/corrupted
  | 'SOURCE_UNAVAILABLE';  // Could not get page source

/**
 * Structured error for the import pipeline.
 * Provides consistent error representation across all layers.
 */
export interface ImportError {
  /** Error code for programmatic handling */
  code: ImportErrorCode;
  /** User-safe message suitable for display in UI */
  message: string;
  /** Optional developer-oriented details for debugging */
  details?: string;
}

/**
 * Discriminated union Result type for import operations.
 * Use this for operations that can fail with expected errors.
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: ImportError };

/**
 * Creates a successful Result.
 */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/**
 * Creates a failed Result.
 */
export function err<T>(error: ImportError): Result<T> {
  return { ok: false, error };
}

/**
 * Creates an ImportError with the given code and message.
 */
export function createImportError(
  code: ImportErrorCode,
  message: string,
  details?: string
): ImportError {
  return { code, message, details };
}

/**
 * User-friendly error messages by error code.
 * Used to provide consistent messaging across the UI.
 */
export const ERROR_MESSAGES: Record<ImportErrorCode, string> = {
  EMPTY_HTML: 'Please paste the page source HTML. The content appears to be empty.',
  INPUT_TOO_LARGE: 'The pasted content is too large to process safely. Please copy a smaller range of bets and try again.',
  NO_BETS_FOUND: 'No bets were found in the HTML. Make sure you copied the full page source from your settled bets page.',
  PARSER_FAILED: 'An unexpected error occurred while parsing. Please check the page source and try again.',
  PARSER_NOT_AVAILABLE: 'No parser is available for this sportsbook yet.',
  VALIDATION_BLOCKED: 'Some bets have issues that must be fixed before importing.',
  STORAGE_FAILED: 'Failed to save bets. Please try again.',
  STORAGE_CORRUPTED: 'Saved data was corrupted and has been reset. We attempted to create a backup.',
  SOURCE_UNAVAILABLE: 'Could not retrieve page source.',
};

/**
 * Gets the user-friendly message for an error code.
 */
export function getErrorMessage(code: ImportErrorCode): string {
  return ERROR_MESSAGES[code] || 'An unexpected error occurred.';
}

/**
 * Custom error thrown when a PageSourceProvider cannot retrieve data.
 * @deprecated Use Result<T> pattern with ImportError instead
 */
export class NoSourceDataError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NoSourceDataError";
    }
}
