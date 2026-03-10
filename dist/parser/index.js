"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRecipeFile = parseRecipeFile;
exports.getRecipeVarRaw = getRecipeVarRaw;
exports.scanLayerRecipeFiles = scanLayerRecipeFiles;
exports.findRecipeFiles = findRecipeFiles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Supported assignment operators in order of specificity (longest first)
const ASSIGNMENT_OPERATORS = [":=", "?=", "+=", ".=", "="];
// Override suffixes that trigger a warning instead of parsing
const OVERRIDE_SUFFIXES = /:(append|prepend|remove|[a-z][a-z0-9_-]*)$/;
// Matches a variable assignment line: NAME OP "value" or NAME OP 'value'
// Groups: 1=name, 2=operator, 3=value content
const ASSIGNMENT_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*(:=|\?=|\+=|\.=|=)\s*["'](.*?)["']\s*(?:#.*)?$/;
// Same but for multiline start (value ends with \)
const ASSIGNMENT_ML_START_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*(:=|\?=|\+=|\.=|=)\s*["'](.*\\)\s*$/;
// Variable name with override syntax: VAR:append, VAR:append:machine, etc.
// Handles multiple colon-separated override components
const VAR_WITH_OVERRIDE_RE = /^([A-Za-z_][A-Za-z0-9_]*)(?::[A-Za-z_$][\w${}-]*)+\s*(:=|\?=|\+=|\.=|=)/;
// Variable flag syntax: VAR[flag] = ... (unsupported in v1, emit warning)
const VAR_FLAG_RE = /^([A-Za-z_][A-Za-z0-9_]*)\[[\w.]+\]\s*(:=|\?=|\+=|\.=|=)/;
function parseRecipeFile(filePath) {
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
    const variables = [];
    const warnings = [];
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
            warnings.push(`Line ${i + 1}: override syntax not parsed: ${trimmed.substring(0, 80)}`);
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
                }
                else {
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
        // Check for variable flag syntax VAR[flag] = ... (unsupported in v1)
        const flagMatch = VAR_FLAG_RE.exec(trimmed);
        if (flagMatch) {
            warnings.push(`Line ${i + 1}: variable flag syntax not parsed: ${trimmed.substring(0, 80)}`);
            i++;
            continue;
        }
        // Not a recognized assignment — skip silently (could be inherit, require, include, etc.)
        i++;
    }
    const result = { ok: true, variables };
    if (warnings.length > 0) {
        result.warnings = warnings;
    }
    return result;
}
function getRecipeVarRaw(filePath, variable) {
    if (!variable || variable.trim() === "") {
        return {
            ok: false,
            error_code: "INVALID_ARGUMENT",
            message: "variable must be a non-empty string",
        };
    }
    const parsed = parseRecipeFile(filePath);
    if (!parsed.ok)
        return parsed;
    const assignments = parsed.variables
        .filter((v) => v.name === variable)
        .map(({ operator, raw_value, line }) => ({ operator, raw_value, line }));
    return { ok: true, assignments };
}
function scanLayerRecipeFiles(layerPath) {
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
    const files = [];
    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === "node_modules" || entry.name.startsWith("."))
                continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            }
            else if (entry.isFile()) {
                if (entry.name.endsWith(".bbappend")) {
                    files.push({ path: fullPath, file_type: "bbappend" });
                }
                else if (entry.name.endsWith(".bb")) {
                    files.push({ path: fullPath, file_type: "bb" });
                }
            }
        }
    }
    walk(layerPath);
    files.sort((a, b) => a.path.localeCompare(b.path));
    return { ok: true, files };
}
function findRecipeFiles(rootPath, query) {
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
    const matches = [];
    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === "node_modules" || entry.name.startsWith("."))
                continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            }
            else if (entry.isFile()) {
                const name = entry.name;
                if ((name.endsWith(".bb") || name.endsWith(".bbappend")) &&
                    name.toLowerCase().includes(lowerQuery)) {
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
//# sourceMappingURL=index.js.map