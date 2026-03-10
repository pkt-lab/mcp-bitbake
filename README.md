# mcp-bitbake

A deterministic [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server for BitBake/Yocto. Inspects recipe metadata without evaluating variables — returns only raw assignments as found in files.

**Design rules:**
- Never evaluates variables — only returns raw assignments
- Only supports `.bb` and `.bbappend` files
- Supported operators: `=`, `:=`, `?=`, `+=`, `.=`
- Returns structured JSON for all responses
- Fails closed on unsupported syntax (override syntax warned, not parsed)

## Install

**From GitHub (no npm publish needed):**

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

### `find_recipe_files`

Search recursively for `.bb`/`.bbappend` files matching a filename pattern:

```json
{ "root_path": "/path/to/poky", "query": "busybox" }
```

Returns: `{ ok: true, matches: [{ path, file_type, filename }] }`

### `scan_layer_recipe_files`

List all `.bb`/`.bbappend` files under a layer path:

```json
{ "layer_path": "/path/to/meta-mylayer" }
```

Returns: `{ ok: true, files: [{ path, file_type }] }`

### `parse_recipe_file`

Parse a single `.bb` or `.bbappend` file and return all raw variable assignments:

```json
{ "file_path": "/path/to/meta-layer/recipes-core/myapp/myapp_1.0.bb" }
```

Returns: `{ ok: true, variables: [{ name, operator, raw_value, line }], warnings?: [...] }`

- Comments and python/shell function blocks are skipped
- Override syntax (`VAR:append`, `VAR:${PN}`, etc.) is warned but not parsed
- Multi-line values (lines ending with `\`) are concatenated into `raw_value`

### `get_recipe_var_raw`

Get all assignments for a specific variable in a file:

```json
{ "file_path": "/path/to/recipe.bb", "variable": "SRC_URI" }
```

Returns: `{ ok: true, assignments: [{ operator, raw_value, line }] }`

## Error format

All errors return:

```json
{ "ok": false, "error_code": "...", "message": "..." }
```

Error codes: `FILE_NOT_FOUND`, `INVALID_PATH`, `UNSUPPORTED_SYNTAX`, `INVALID_ARGUMENT`

## License

MIT
