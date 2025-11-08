/**
 * Logger Utility
 * Structured logging for edge functions
 */

/**
 * Log with context
 */
export const log = (level: 'info' | 'warn' | 'error', message: string, context?: unknown) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (level === 'error') {
    console.error(logMessage, context || '');
  } else if (level === 'warn') {
    console.warn(logMessage, context || '');
  } else {
    console.log(logMessage, context || '');
  }
};

export const logInfo = (message: string, context?: unknown) => log('info', message, context);
export const logWarn = (message: string, context?: unknown) => log('warn', message, context);
export const logError = (message: string, context?: unknown) => log('error', message, context);

