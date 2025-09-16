// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/** Utility functions for flag evaluation and data processing */

/** Generates cryptographically secure UUID */
export function generateId(): string {
  return crypto.randomUUID();
}

/** Safely parses JSON, returns original value on failure */
export function parseJSON<T = unknown>(value: unknown): T {
  if (typeof value !== "string") {
    return value as T;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

/** Creates SHA-256 hash of string, returns hex digest */
export async function hash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Deterministic percentage rollout using DJB2 hash.
 * @algorithm DJB2 hash for uniform distribution, O(n) complexity
 * @important '| 0' forces 32-bit integers, prevents float precision issues
 */
export function calculateRollout(userId: string, percentage: number): boolean {
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;

  // DJB2 hash: (hash * 33) + char, with 32-bit overflow
  const hashValue = userId.split("").reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0; // (acc * 31) + char
  }, 0);

  return Math.abs(hashValue) % 100 < percentage;
}

/**
 * Validates flag value against expected type.
 * @throws {Error} Type mismatch or invalid type
 */
export function validateValueType(value: any, type: string): boolean {
  switch (type) {
    case "boolean":
      if (typeof value !== "boolean") {
        throw new Error(`Expected boolean, got ${typeof value}`);
      }
      return true;
    case "string":
      if (typeof value !== "string") {
        throw new Error(`Expected string, got ${typeof value}`);
      }
      return true;
    case "number":
      if (typeof value !== "number" || isNaN(value)) {
        throw new Error(`Expected number, got ${typeof value}`);
      }
      return true;
    case "json":
      // Any valid JSON value is acceptable
      if (value === undefined) {
        throw new Error("Value cannot be undefined for JSON type");
      }
      return true;
    default:
      throw new Error(`Unknown flag type: ${type}`);
  }
}

/** Evaluates targeting rule conditions for flag evaluation */
export function evaluateCondition(
  value: any,
  operator: string,
  target: any,
): boolean {
  switch (operator) {
    case "equals":
      return value === target;
    case "not_equals":
      return value !== target;
    case "contains":
      return String(value).includes(String(target));
    case "not_contains":
      return !String(value).includes(String(target));
    case "starts_with":
      return String(value).startsWith(String(target));
    case "ends_with":
      return String(value).endsWith(String(target));
    case "greater_than":
      return Number(value) > Number(target);
    case "less_than":
      return Number(value) < Number(target);
    case "greater_than_or_equal":
      return Number(value) >= Number(target);
    case "less_than_or_equal":
      return Number(value) <= Number(target);
    case "in":
      return Array.isArray(target) ? target.includes(value) : false;
    case "not_in":
      return Array.isArray(target) ? !target.includes(value) : true;
    case "regex":
      try {
        return new RegExp(String(target)).test(String(value));
      } catch {
        return false; // Invalid regex
      }
    default:
      return false;
  }
}
