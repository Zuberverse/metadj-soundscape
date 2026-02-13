/**
 * Error Messages Module Tests
 * Tests getUserFriendlyError, formatErrorMessage, isRecoverableError
 */

import { describe, expect, it } from "vitest";
import {
  getUserFriendlyError,
  formatErrorMessage,
  isRecoverableError,
  ERROR_MESSAGES,
} from "../src/lib/scope/error-messages";
import type { ScopeErrorCode } from "../src/lib/scope/use-scope-connection";

describe("error-messages", () => {
  describe("getUserFriendlyError", () => {
    it("returns correct message for each error code", () => {
      const codes: ScopeErrorCode[] = [
        "HEALTH_CHECK_FAILED",
        "PIPELINE_LOAD_FAILED",
        "CONNECTION_FAILED",
        "CONNECTION_LOST",
        "STREAM_STOPPED",
        "DATA_CHANNEL_ERROR",
        "UNKNOWN",
      ];

      for (const code of codes) {
        const result = getUserFriendlyError(code);
        expect(result.title).toBeTruthy();
        expect(result.description).toBeTruthy();
        expect(result.suggestion).toBeTruthy();
        expect(result).toEqual(ERROR_MESSAGES[code]);
      }
    });

    it("returns UNKNOWN for invalid code", () => {
      const result = getUserFriendlyError("NONEXISTENT" as ScopeErrorCode);
      expect(result).toEqual(ERROR_MESSAGES.UNKNOWN);
    });
  });

  describe("formatErrorMessage", () => {
    it("combines title and description", () => {
      const result = formatErrorMessage("HEALTH_CHECK_FAILED");
      expect(result).toBe("Server Unavailable: Unable to connect to the AI generation server.");
    });

    it("handles UNKNOWN code", () => {
      const result = formatErrorMessage("UNKNOWN");
      expect(result).toContain("Unexpected Error");
    });
  });

  describe("isRecoverableError", () => {
    it("identifies recoverable errors", () => {
      expect(isRecoverableError("CONNECTION_LOST")).toBe(true);
      expect(isRecoverableError("STREAM_STOPPED")).toBe(true);
      expect(isRecoverableError("DATA_CHANNEL_ERROR")).toBe(true);
    });

    it("identifies non-recoverable errors", () => {
      expect(isRecoverableError("HEALTH_CHECK_FAILED")).toBe(false);
      expect(isRecoverableError("PIPELINE_LOAD_FAILED")).toBe(false);
      expect(isRecoverableError("CONNECTION_FAILED")).toBe(false);
      expect(isRecoverableError("UNKNOWN")).toBe(false);
    });
  });
});
