#! /usr/bin/env node
// index.ts MCP server that handles stdio

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp/server.js";

async function main() {
    const server = createServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
}

main().catch(console.error);