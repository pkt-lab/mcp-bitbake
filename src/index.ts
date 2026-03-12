#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  parseRecipeFile,
  getRecipeVarRaw,
  scanLayerRecipeFiles,
  findRecipeFiles,
} from "./parser/index.js";
import { validateDirPath, validateFilePath } from "./validation.js";

const server = new Server(
  { name: "mcp-bitbake", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "find_recipe_files",
      description:
        "Search recursively for .bb/.bbappend files matching a filename query under root_path.",
      inputSchema: {
        type: "object",
        properties: {
          root_path: {
            type: "string",
            description: "Directory to search recursively",
          },
          query: {
            type: "string",
            description: "Substring to match against filenames",
          },
        },
        required: ["root_path", "query"],
      },
    },
    {
      name: "scan_layer_recipe_files",
      description: "List all .bb/.bbappend files under a Yocto layer path.",
      inputSchema: {
        type: "object",
        properties: {
          layer_path: {
            type: "string",
            description: "Root directory of the Yocto layer",
          },
        },
        required: ["layer_path"],
      },
    },
    {
      name: "parse_recipe_file",
      description:
        "Parse a single .bb or .bbappend file and return all raw variable assignments. Never evaluates variables.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "Absolute or relative path to the .bb or .bbappend file",
          },
        },
        required: ["file_path"],
      },
    },
    {
      name: "get_recipe_var_raw",
      description:
        "Get all raw assignments for a specific variable in a .bb or .bbappend file.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "Path to the .bb or .bbappend file",
          },
          variable: {
            type: "string",
            description: "Variable name to look up (e.g. SRC_URI, PN, PV)",
          },
        },
        required: ["file_path", "variable"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "find_recipe_files": {
        const { root_path, query } = args as { root_path: string; query: string };
        if (typeof root_path !== "string" || typeof query !== "string") {
          return result({ ok: false, error_code: "INVALID_ARGUMENT", message: "root_path and query must be strings" });
        }
        const v1 = validateDirPath(root_path);
        if (!v1.ok) return result(v1);
        return result(findRecipeFiles(root_path, query));
      }

      case "scan_layer_recipe_files": {
        const { layer_path } = args as { layer_path: string };
        if (typeof layer_path !== "string") {
          return result({ ok: false, error_code: "INVALID_ARGUMENT", message: "layer_path must be a string" });
        }
        const v2 = validateDirPath(layer_path);
        if (!v2.ok) return result(v2);
        return result(scanLayerRecipeFiles(layer_path));
      }

      case "parse_recipe_file": {
        const { file_path } = args as { file_path: string };
        if (typeof file_path !== "string") {
          return result({ ok: false, error_code: "INVALID_ARGUMENT", message: "file_path must be a string" });
        }
        const v3 = validateFilePath(file_path);
        if (!v3.ok) return result(v3);
        return result(parseRecipeFile(file_path));
      }

      case "get_recipe_var_raw": {
        const { file_path, variable } = args as { file_path: string; variable: string };
        if (typeof file_path !== "string" || typeof variable !== "string") {
          return result({ ok: false, error_code: "INVALID_ARGUMENT", message: "file_path and variable must be strings" });
        }
        const v4 = validateFilePath(file_path);
        if (!v4.ok) return result(v4);
        return result(getRecipeVarRaw(file_path, variable));
      }

      default:
        return result({
          ok: false,
          error_code: "UNSUPPORTED_SYNTAX",
          message: `Unknown tool: ${name}`,
        });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return result({ ok: false, error_code: "UNSUPPORTED_SYNTAX", message });
  }
});

function result(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
