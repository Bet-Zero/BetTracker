/**
 * Handles localStorage errors and provides user-friendly error messages
 */

export interface StorageErrorInfo {
  message: string;
  suggestion: string;
  isRecoverable?: boolean;
  backupCreated?: boolean;
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
      suggestion: 'Please clear some browser storage or export your data as a backup using Settings > Export JSON Backup.',
      isRecoverable: true,
    };
  }
  
  if (errorMessage.includes('SecurityError') || errorMessage.includes('disabled')) {
    return {
      message: 'Browser storage is disabled or blocked.',
      suggestion: 'Please enable localStorage in your browser settings or check privacy settings.',
      isRecoverable: false,
    };
  }
  
  // Check for corruption errors
  if (errorMessage.includes('corrupted') || errorMessage.includes('invalid')) {
    return {
      message: 'Your saved data was corrupted.',
      suggestion: 'A backup was automatically created. You can find it in Settings > Export JSON Backup. The app has been reset to a clean state.',
      isRecoverable: true,
      backupCreated: true,
    };
  }
  
  // Generic error
  return {
    message: `Failed to ${operation} data: ${errorMessage}`,
    suggestion: 'Please check your browser console for details. Consider exporting your data as a backup using Settings > Export JSON Backup.',
    isRecoverable: true,
  };
};

/**
 * Shows a user-visible error notification with better formatting.
 * 
 * NOTE: This uses `alert()` for critical storage errors that the user must acknowledge.
 * For a more polished UX, consider implementing a global toast/notification context
 * that can be used across the application.
 * 
 * @param errorInfo - Error information to display
 */
export const showStorageError = (errorInfo: StorageErrorInfo): void => {
  // Log to console first for debugging
  console.error('[Storage Error]', errorInfo.message);
  if (errorInfo.suggestion) {
    console.info('[Storage Suggestion]', errorInfo.suggestion);
  }
  
  // Build a user-friendly message
  let fullMessage = `⚠️ ${errorInfo.message}`;
  
  if (errorInfo.backupCreated) {
    fullMessage += '\n\n✓ A backup was automatically created.';
  }
  
  fullMessage += '\n\n' + errorInfo.suggestion;
  
  // Use alert() for critical storage errors that must be acknowledged
  // These are rare events (storage corruption, quota exceeded) where the user
  // needs to take action before continuing
  alert(fullMessage);
};

/**
 * Creates a formatted corruption recovery message for display
 * @param options - Optional configuration
 * @param options.backupKey - The localStorage key where backup was saved
 */
export const getCorruptionRecoveryMessage = (options?: { backupKey?: string }): StorageErrorInfo => {
  const backupKey = options?.backupKey;
  return {
    message: 'Data Recovery Complete',
    suggestion: backupKey 
      ? `Your previous data was corrupted and has been backed up to "${backupKey}". The app has been reset. You can export the backup from Settings if needed.`
      : 'Your previous data was corrupted. A backup was created automatically. The app has been reset to a clean state.',
    isRecoverable: true,
    backupCreated: true,
  };
};
