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
export declare function validateDirPath(p: string): ValidationResult;
/**
 * Validate a recipe file path (file_path).
 * - Must be absolute
 * - Must not contain ".." components
 * - Must end with .bb or .bbappend
 */
export declare function validateFilePath(p: string): ValidationResult;
//# sourceMappingURL=validation.d.ts.map