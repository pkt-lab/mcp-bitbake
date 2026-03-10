#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { parseRecipeFile, scanLayerForRecipes } from './parser/recipe.js';

const server = new Server(
  { name: 'mcp-bitbake', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'parse_recipe',
      description: 'Parse a single BitBake .bb or .bbappend recipe file and return its metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Absolute path to the .bb or .bbappend file' },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'scan_layer',
      description: 'Scan a Yocto layer directory for all recipes and return metadata for each.',
      inputSchema: {
        type: 'object',
        properties: {
          layer_path: { type: 'string', description: 'Path to the Yocto layer directory' },
        },
        required: ['layer_path'],
      },
    },
    {
      name: 'find_recipe',
      description: 'Search recipes in a layer by name substring. Returns up to 10 matches.',
      inputSchema: {
        type: 'object',
        properties: {
          layer_path: { type: 'string', description: 'Path to the Yocto layer directory' },
          query: { type: 'string', description: 'Substring to search for in recipe names' },
        },
        required: ['layer_path', 'query'],
      },
    },
    {
      name: 'get_recipe_deps',
      description: 'Get DEPENDS and RDEPENDS for a named recipe in a layer.',
      inputSchema: {
        type: 'object',
        properties: {
          layer_path: { type: 'string', description: 'Path to the Yocto layer directory' },
          recipe_name: { type: 'string', description: 'Recipe name (PN) to look up' },
        },
        required: ['layer_path', 'recipe_name'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'parse_recipe') {
    const filePath = args?.file_path as string;
    const metadata = parseRecipeFile(filePath);
    return {
      content: [{ type: 'text', text: JSON.stringify(metadata, null, 2) }],
    };
  }

  if (name === 'scan_layer') {
    const layerPath = args?.layer_path as string;
    const recipes = scanLayerForRecipes(layerPath);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ count: recipes.length, recipes }, null, 2),
        },
      ],
    };
  }

  if (name === 'find_recipe') {
    const layerPath = args?.layer_path as string;
    const query = (args?.query as string).toLowerCase();
    const recipes = scanLayerForRecipes(layerPath);
    const matches = recipes
      .filter((r) => r.name.toLowerCase().includes(query))
      .slice(0, 10);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ count: matches.length, matches }, null, 2),
        },
      ],
    };
  }

  if (name === 'get_recipe_deps') {
    const layerPath = args?.layer_path as string;
    const recipeName = (args?.recipe_name as string).toLowerCase();
    const recipes = scanLayerForRecipes(layerPath);
    const recipe = recipes.find((r) => r.name.toLowerCase() === recipeName);
    if (!recipe) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Recipe '${args?.recipe_name}' not found` }) }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { name: recipe.name, version: recipe.version, depends: recipe.depends, rdepends: recipe.rdepends },
            null,
            2
          ),
        },
      ],
    };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
    isError: true,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
