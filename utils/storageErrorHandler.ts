/**
 * Handles localStorage errors and provides user-friendly error messages
 */

export interface StorageErrorInfo {
  message: string;
  suggestion: string;
}

/**
 * Handles localStorage errors and returns user-friendly information
 * @param error - The error that occurred
 * @param operation - The operation that failed (e.g., 'save', 'load', 'clear')
 * @returns Error information with message and suggestion
 */
export const handleStorageError = (
  error: unknown,
  operation: 'save' | 'load' | 'clear'
): StorageErrorInfo => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Check for common localStorage errors
  if (errorMessage.includes('QuotaExceededError') || errorMessage.includes('quota')) {
    return {
      message: 'Storage is full. Your data could not be saved.',
      suggestion: 'Please clear some browser storage or export your data as a backup.',
    };
  }
  
  if (errorMessage.includes('SecurityError') || errorMessage.includes('disabled')) {
    return {
      message: 'Browser storage is disabled or blocked.',
      suggestion: 'Please enable localStorage in your browser settings or check privacy settings.',
    };
  }
  
  // Generic error
  return {
    message: `Failed to ${operation} data: ${errorMessage}`,
    suggestion: 'Please check your browser console for details. Consider exporting your data as a backup.',
  };
};

/**
 * Shows a user-visible error notification
 * This is a simple implementation that uses alert().
 * TODO: Replace with a proper toast/notification system when available.
 */
export const showStorageError = (errorInfo: StorageErrorInfo): void => {
  // For now, use alert. In a production app, this would use a toast/notification system.
  alert(`${errorInfo.message}\n\n${errorInfo.suggestion}`);
  console.error('Storage Error:', errorInfo.message, errorInfo.suggestion);
};

