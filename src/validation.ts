import * as path from "path";

export interface ValidationError {
  ok: false;
  error_code: "INVALID_PATH";
  message: string;
}

export interface ValidationOk {
  ok: true;
}

export type ValidationResult = ValidationOk | ValidationError;

/**
 * Validate a directory path (root_path, layer_path).
 * - Must be absolute
 * - Must not contain ".." components
 */
export function validateDirPath(p: string): ValidationResult {
  if (!path.isAbsolute(p)) {
    return {
      ok: false,
      error_code: "INVALID_PATH",
      message: `Path must be absolute: ${p}`,
    };
  }

  if (p.includes("..")) {
    return {
      ok: false,
      error_code: "INVALID_PATH",
      message: `Path traversal attempt detected: ${p}`,
    };
  }

  // Normalize and re-check to catch encoded or indirect traversal
  const normalized = path.normalize(p);
  if (normalized.includes("..")) {
    return {
      ok: false,
      error_code: "INVALID_PATH",
      message: `Path traversal attempt detected: ${p}`,
    };
  }

  return { ok: true };
}

/**
 * Validate a recipe file path (file_path).
 * - Must be absolute
 * - Must not contain ".." components
 * - Must end with .bb or .bbappend
 */
export function validateFilePath(p: string): ValidationResult {
  if (!path.isAbsolute(p)) {
    return {
      ok: false,
      error_code: "INVALID_PATH",
      message: `Path must be absolute: ${p}`,
    };
  }

  if (p.includes("..")) {
    return {
      ok: false,
      error_code: "INVALID_PATH",
      message: `Path traversal attempt detected: ${p}`,
    };
  }

  const normalized = path.normalize(p);
  if (normalized.includes("..")) {
    return {
      ok: false,
      error_code: "INVALID_PATH",
      message: `Path traversal attempt detected: ${p}`,
    };
  }

  const ext = path.extname(p);
  if (ext !== ".bb" && ext !== ".bbappend") {
    return {
      ok: false,
      error_code: "INVALID_PATH",
      message: `File must have .bb or .bbappend extension, got: ${p}`,
    };
  }

  return { ok: true };
}
