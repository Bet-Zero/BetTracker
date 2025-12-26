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
 * @param errorInfo - Error information to display
 */
export const showStorageError = (errorInfo: StorageErrorInfo): void => {
  // Build a more informative message
  let fullMessage = errorInfo.message;
  
  if (errorInfo.backupCreated) {
    fullMessage += '\n\n✓ A backup was automatically created.';
  }
  
  fullMessage += '\n\n' + errorInfo.suggestion;
  
  // Use alert for now - in a production app this would use a toast/notification system
  alert(fullMessage);
  console.error('Storage Error:', errorInfo.message, errorInfo.suggestion);
};

/**
 * Creates a formatted corruption recovery message for display
 */
export const getCorruptionRecoveryMessage = (backupKey?: string): StorageErrorInfo => {
  return {
    message: 'Data Recovery Complete',
    suggestion: backupKey 
      ? `Your previous data was corrupted and has been backed up to "${backupKey}". The app has been reset. You can export the backup from Settings if needed.`
      : 'Your previous data was corrupted. A backup was created automatically. The app has been reset to a clean state.',
    isRecoverable: true,
    backupCreated: true,
  };
};
