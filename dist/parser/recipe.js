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
exports.scanLayerForRecipes = scanLayerForRecipes;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Parse a single .bb or .bbappend file
function parseRecipeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const layerPath = path.dirname(path.dirname(path.dirname(filePath)));
    const fileName = path.basename(filePath, path.extname(filePath));
    // Extract PN and PV from filename (e.g. myapp_1.0.bb)
    const nameParts = fileName.split('_');
    const name = nameParts[0] || fileName;
    const version = nameParts[1] || 'unknown';
    const variables = {};
    // Parse variable assignments: VAR = "value", VAR ?= "value", VAR += "value"
    const assignmentRegex = /^([A-Z_][A-Z0-9_:]*(?:\[.*?\])?)\s*(?:\?=|:=|\+=|\??\?=|=)\s*"([^"]*)"$/gm;
    let match;
    while ((match = assignmentRegex.exec(content)) !== null) {
        variables[match[1]] = match[2];
    }
    // Parse multi-line values with backslash continuation
    const multilineRegex = /^([A-Z_][A-Z0-9_:]*)\s*(?:\?=|:=|\+=|=)\s*"((?:[^"\\]|\\[\s\S])*?)"\s*$/gm;
    while ((match = multilineRegex.exec(content)) !== null) {
        if (!variables[match[1]]) {
            variables[match[1]] = match[2].replace(/\\\n\s*/g, ' ').trim();
        }
    }
    return {
        name: variables['PN'] || name,
        version: variables['PV'] || version,
        description: variables['DESCRIPTION'] || variables['SUMMARY'] || '',
        license: variables['LICENSE'] || 'unknown',
        srcUri: parseSrcUri(variables['SRC_URI'] || ''),
        depends: parseDeps(variables['DEPENDS'] || ''),
        rdepends: parseDeps(variables['RDEPENDS'] || variables['RDEPENDS_${PN}'] || ''),
        inherit: parseInherit(content),
        layerPath,
        filePath,
        variables,
    };
}
function parseSrcUri(value) {
    return value.split(/\s+/).filter(s => s.length > 0 && !s.startsWith('\\'));
}
function parseDeps(value) {
    return value.split(/[\s]+/).map(s => s.trim()).filter(s => s.length > 0 && s !== '\\');
}
function parseInherit(content) {
    const results = [];
    const inheritRegex = /^inherit\s+(.+)$/gm;
    let match;
    while ((match = inheritRegex.exec(content)) !== null) {
        results.push(...match[1].trim().split(/\s+/));
    }
    return results;
}
// Scan a directory tree for .bb and .bbappend files
function scanLayerForRecipes(layerPath) {
    const recipes = [];
    function walk(dir) {
        if (!fs.existsSync(dir))
            return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && entry.name !== 'node_modules') {
                walk(fullPath);
            }
            else if (entry.isFile() && (entry.name.endsWith('.bb') || entry.name.endsWith('.bbappend'))) {
                try {
                    recipes.push(parseRecipeFile(fullPath));
                }
                catch {
                    // Skip unparseable files
                }
            }
        }
    }
    walk(layerPath);
    return recipes;
}
//# sourceMappingURL=recipe.js.map