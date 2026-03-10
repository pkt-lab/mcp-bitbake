import * as fs from 'fs';
import * as path from 'path';

export interface RecipeMetadata {
  name: string;
  version: string;
  description: string;
  license: string;
  srcUri: string[];
  depends: string[];
  rdepends: string[];
  inherit: string[];
  layerPath: string;
  filePath: string;
  variables: Record<string, string>;
}

// Parse a single .bb or .bbappend file
export function parseRecipeFile(filePath: string): RecipeMetadata {
  const content = fs.readFileSync(filePath, 'utf-8');
  const layerPath = path.dirname(path.dirname(path.dirname(filePath)));
  const fileName = path.basename(filePath, path.extname(filePath));
  
  // Extract PN and PV from filename (e.g. myapp_1.0.bb)
  const nameParts = fileName.split('_');
  const name = nameParts[0] || fileName;
  const version = nameParts[1] || 'unknown';

  const variables: Record<string, string> = {};
  
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

function parseSrcUri(value: string): string[] {
  return value.split(/\s+/).filter(s => s.length > 0 && !s.startsWith('\\'));
}

function parseDeps(value: string): string[] {
  return value.split(/[\s]+/).map(s => s.trim()).filter(s => s.length > 0 && s !== '\\');
}

function parseInherit(content: string): string[] {
  const results: string[] = [];
  const inheritRegex = /^inherit\s+(.+)$/gm;
  let match;
  while ((match = inheritRegex.exec(content)) !== null) {
    results.push(...match[1].trim().split(/\s+/));
  }
  return results;
}

// Scan a directory tree for .bb and .bbappend files
export function scanLayerForRecipes(layerPath: string): RecipeMetadata[] {
  const recipes: RecipeMetadata[] = [];
  
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.bb') || entry.name.endsWith('.bbappend'))) {
        try {
          recipes.push(parseRecipeFile(fullPath));
        } catch {
          // Skip unparseable files
        }
      }
    }
  }
  
  walk(layerPath);
  return recipes;
}
