/**
 * User-Friendly Error Messages for Scope Connection
 *
 * Maps technical error codes to human-readable messages with recovery suggestions.
 */

import type { ScopeErrorCode } from "./use-scope-connection";

export interface UserFriendlyError {
  /** User-facing error title */
  title: string;
  /** User-facing error description */
  description: string;
  /** Suggested action for the user */
  suggestion: string;
}

/**
 * Maps Scope error codes to user-friendly messages.
 * Technical details are kept in the console; users see helpful guidance.
 */
export const ERROR_MESSAGES: Record<ScopeErrorCode, UserFriendlyError> = {
  HEALTH_CHECK_FAILED: {
    title: "Server Unavailable",
    description: "Unable to connect to the AI generation server.",
    suggestion: "Check if the Scope server is running, or try again in a moment.",
  },
  PIPELINE_LOAD_FAILED: {
    title: "Generation Engine Error",
    description: "The AI generation pipeline failed to initialize.",
    suggestion: "The server may be busy. Wait a few seconds and try again.",
  },
  CONNECTION_FAILED: {
    title: "Connection Failed",
    description: "Could not establish a video connection.",
    suggestion: "Check your internet connection and try again.",
  },
  CONNECTION_LOST: {
    title: "Connection Lost",
    description: "The video connection was interrupted.",
    suggestion: "Reconnecting automatically...",
  },
  STREAM_STOPPED: {
    title: "Video Stream Ended",
    description: "The AI generation stream stopped unexpectedly.",
    suggestion: "Attempting to reconnect...",
  },
  DATA_CHANNEL_ERROR: {
    title: "Communication Error",
    description: "Lost connection to the parameter channel.",
    suggestion: "Reconnecting automatically...",
  },
  UNKNOWN: {
    title: "Unexpected Error",
    description: "Something went wrong.",
    suggestion: "Please try again. If the problem persists, refresh the page.",
  },
};

/**
 * Get a user-friendly error message for a Scope error code.
 *
 * @param code - The technical error code
 * @param technicalMessage - Optional technical message for console logging
 * @returns User-friendly error object
 */
export function getUserFriendlyError(
  code: ScopeErrorCode,
  technicalMessage?: string
): UserFriendlyError {
  const error = ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN;

  // Log technical details to console for debugging
  if (technicalMessage && process.env.NODE_ENV === "development") {
    console.warn(`[Scope Error] ${code}: ${technicalMessage}`);
  }

  return error;
}

/**
 * Format an error for display to the user.
 * Combines title and description into a single message.
 *
 * @param code - The technical error code
 * @returns Formatted user-facing message
 */
export function formatErrorMessage(code: ScopeErrorCode): string {
  const error = ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN;
  return `${error.title}: ${error.description}`;
}

/**
 * Check if an error code indicates a recoverable situation.
 *
 * @param code - The technical error code
 * @returns True if auto-reconnection should be attempted
 */
export function isRecoverableError(code: ScopeErrorCode): boolean {
  const recoverableCodes: ScopeErrorCode[] = [
    "CONNECTION_LOST",
    "STREAM_STOPPED",
    "DATA_CHANNEL_ERROR",
  ];
  return recoverableCodes.includes(code);
}
