#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";

/** Entry point: serve the dexel MCP builder over stdio. */
const server = createMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
