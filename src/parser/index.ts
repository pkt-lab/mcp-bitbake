import * as fs from "fs";
import * as path from "path";

export interface VariableAssignment {
  name: string;
  operator: string;
  raw_value: string;
  line: number;
}

export interface ParseResult {
  ok: true;
  variables: VariableAssignment[];
  warnings?: string[];
}

export interface ErrorResult {
  ok: false;
  error_code: string;
  message: string;
}

// Supported assignment operators in order of specificity (longest first)
const ASSIGNMENT_OPERATORS = [":=", "?=", "+=", ".=", "="];

// Override suffixes that trigger a warning instead of parsing
const OVERRIDE_SUFFIXES = /:(append|prepend|remove|[a-z][a-z0-9_-]*)$/;

// Matches a variable assignment line: NAME OP "value" or NAME OP 'value'
// Groups: 1=name, 2=operator, 3=value content
const ASSIGNMENT_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*(:=|\?=|\+=|\.=|=)\s*["'](.*?)["']\s*(?:#.*)?$/;

// Same but for multiline start (value ends with \)
const ASSIGNMENT_ML_START_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*(:=|\?=|\+=|\.=|=)\s*["'](.*\\)\s*$/;

// Variable name with override syntax (VAR:something or VAR:${VAR} etc.)
const VAR_WITH_OVERRIDE_RE = /^([A-Za-z_][A-Za-z0-9_]*):[A-Za-z$_][\w${}-]*\s*(:=|\?=|\+=|\.=|=)/;

export function parseRecipeFile(filePath: string): ParseResult | ErrorResult {
  // Validate path
  const ext = path.extname(filePath);
  if (ext !== ".bb" && ext !== ".bbappend") {
    return {
      ok: false,
      error_code: "INVALID_PATH",
      message: `File must be a .bb or .bbappend file, got: ${filePath}`,
    };
  }

  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      error_code: "FILE_NOT_FOUND",
      message: `File not found: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const variables: VariableAssignment[] = [];
  const warnings: string[] = [];

  let i = 0;
  let inPythonBlock = false;
  let inShellBlock = false;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Skip empty lines
    if (trimmed === "") {
      i++;
      continue;
    }

    // Skip full-line comments
    if (trimmed.startsWith("#")) {
      i++;
      continue;
    }

    // Detect python function blocks: python funcname() {
    if (/^python\s+\w*\s*\(/.test(trimmed) || trimmed === "python () {") {
      inPythonBlock = true;
      i++;
      continue;
    }

    // Detect shell function blocks: funcname() {
    if (/^\w+\s*\(\s*\)\s*\{/.test(trimmed)) {
      inShellBlock = true;
      i++;
      continue;
    }

    // Exit function blocks on closing brace at start of line
    if (inPythonBlock || inShellBlock) {
      if (trimmed === "}") {
        inPythonBlock = false;
        inShellBlock = false;
      }
      i++;
      continue;
    }

    // Check for override syntax (VAR:something = ...) — warn, don't parse
    const overrideMatch = VAR_WITH_OVERRIDE_RE.exec(trimmed);
    if (overrideMatch) {
      warnings.push(
        `Line ${i + 1}: override syntax not parsed: ${trimmed.substring(0, 80)}`
      );
      i++;
      // consume continuation lines
      while (i < lines.length && lines[i - 1].trimEnd().endsWith("\\")) {
        i++;
      }
      continue;
    }

    // Try multiline assignment start first
    const mlMatch = ASSIGNMENT_ML_START_RE.exec(trimmed);
    if (mlMatch) {
      const name = mlMatch[1];
      const operator = mlMatch[2];
      const startLine = i + 1;
      let valueAccum = mlMatch[3].slice(0, -1); // strip trailing backslash
      i++;

      while (i < lines.length) {
        const contRaw = lines[i];
        const contTrimmed = contRaw.trim();
        if (contTrimmed.endsWith("\\")) {
          valueAccum += contTrimmed.slice(0, -1);
          i++;
        } else {
          // Last line: strip a trailing closing quote if present
          let last = contTrimmed;
          if (last.endsWith('"') || last.endsWith("'")) {
            last = last.slice(0, -1);
          }
          valueAccum += last;
          i++;
          break;
        }
      }

      variables.push({ name, operator, raw_value: valueAccum, line: startLine });
      continue;
    }

    // Try single-line assignment
    const match = ASSIGNMENT_RE.exec(trimmed);
    if (match) {
      variables.push({
        name: match[1],
        operator: match[2],
        raw_value: match[3],
        line: i + 1,
      });
      i++;
      continue;
    }

    // Not a recognized assignment — skip silently (could be inherit, require, include, etc.)
    i++;
  }

  const result: ParseResult = { ok: true, variables };
  if (warnings.length > 0) {
    result.warnings = warnings;
  }
  return result;
}

export function getRecipeVarRaw(
  filePath: string,
  variable: string
): { ok: true; assignments: { operator: string; raw_value: string; line: number }[] } | ErrorResult {
  if (!variable || variable.trim() === "") {
    return {
      ok: false,
      error_code: "INVALID_ARGUMENT",
      message: "variable must be a non-empty string",
    };
  }

  const parsed = parseRecipeFile(filePath);
  if (!parsed.ok) return parsed;

  const assignments = parsed.variables
    .filter((v) => v.name === variable)
    .map(({ operator, raw_value, line }) => ({ operator, raw_value, line }));

  return { ok: true, assignments };
}

export interface RecipeFileInfo {
  path: string;
  file_type: "bb" | "bbappend";
}

export function scanLayerRecipeFiles(
  layerPath: string
): { ok: true; files: RecipeFileInfo[] } | ErrorResult {
  if (!fs.existsSync(layerPath)) {
    return {
      ok: false,
      error_code: "FILE_NOT_FOUND",
      message: `Layer path not found: ${layerPath}`,
    };
  }

  const stat = fs.statSync(layerPath);
  if (!stat.isDirectory()) {
    return {
      ok: false,
      error_code: "INVALID_PATH",
      message: `Layer path is not a directory: ${layerPath}`,
    };
  }

  const files: RecipeFileInfo[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        if (entry.name.endsWith(".bbappend")) {
          files.push({ path: fullPath, file_type: "bbappend" });
        } else if (entry.name.endsWith(".bb")) {
          files.push({ path: fullPath, file_type: "bb" });
        }
      }
    }
  }

  walk(layerPath);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { ok: true, files };
}

export interface RecipeMatchInfo {
  path: string;
  file_type: "bb" | "bbappend";
  filename: string;
}

export function findRecipeFiles(
  rootPath: string,
  query: string
): { ok: true; matches: RecipeMatchInfo[] } | ErrorResult {
  if (!query || query.trim() === "") {
    return {
      ok: false,
      error_code: "INVALID_ARGUMENT",
      message: "query must be a non-empty string",
    };
  }

  if (!fs.existsSync(rootPath)) {
    return {
      ok: false,
      error_code: "FILE_NOT_FOUND",
      message: `Root path not found: ${rootPath}`,
    };
  }

  const stat = fs.statSync(rootPath);
  if (!stat.isDirectory()) {
    return {
      ok: false,
      error_code: "INVALID_PATH",
      message: `Root path is not a directory: ${rootPath}`,
    };
  }

  const lowerQuery = query.toLowerCase();
  const matches: RecipeMatchInfo[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const name = entry.name;
        if (
          (name.endsWith(".bb") || name.endsWith(".bbappend")) &&
          name.toLowerCase().includes(lowerQuery)
        ) {
          matches.push({
            path: fullPath,
            file_type: name.endsWith(".bbappend") ? "bbappend" : "bb",
            filename: name,
          });
        }
      }
    }
  }

  walk(rootPath);
  matches.sort((a, b) => a.path.localeCompare(b.path));
  return { ok: true, matches };
}
