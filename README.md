# mcp-bitbake

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server for BitBake/Yocto. Lets AI coding assistants parse recipes, scan layers, and navigate Yocto project structure without hallucinating variable names or syntax.

## Install

**From GitHub (no npm needed):**

```bash
npm install github:pkt-lab/mcp-bitbake
```

Or clone and build manually:

```bash
git clone https://github.com/pkt-lab/mcp-bitbake
cd mcp-bitbake
npm install && npm run build
```

## Claude Desktop configuration

### If installed via npm (GitHub):

```json
{
  "mcpServers": {
    "mcp-bitbake": {
      "command": "node",
      "args": ["./node_modules/mcp-bitbake/dist/index.js"]
    }
  }
}
```

### If cloned locally:

```json
{
  "mcpServers": {
    "mcp-bitbake": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-bitbake/dist/index.js"]
    }
  }
}
```

Config file location:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Restart Claude Desktop after editing.

## MCP tools

### `parse_recipe`

Parse a single `.bb` or `.bbappend` recipe file:

```json
{ "file_path": "/path/to/meta-layer/recipes-core/myapp/myapp_1.0.bb" }
```

Returns recipe name, version, license, SRC_URI, dependencies, and all variables.

### `scan_layer`

Scan an entire Yocto layer directory for all recipes:

```json
{ "layer_path": "/path/to/meta-mylayer" }
```

Returns a list of all recipes with their metadata summary.

### `find_recipe`

Search for a recipe by name across a Yocto build directory:

```json
{ "build_dir": "/path/to/poky/build", "recipe_name": "busybox" }
```

### `get_variable`

Extract the value of a specific BitBake variable from a recipe:

```json
{ "file_path": "/path/to/recipe.bb", "variable": "SRC_URI" }
```

## License

MIT
