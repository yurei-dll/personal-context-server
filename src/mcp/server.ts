import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listRecentContext, saveContext, searchContext } from "./tools.js";

export function createServer() {
    const server = new McpServer({
        name: "personal-context-server",
        version: "0.1.0",
    });

    server.registerTool(
        "ping",
        {
            description: "Returns pong."
        },
        async () => {
            return {
                content: [
                    {
                        type: "text",
                        text: "Pong!",
                    },
                ],
            };
        }
    );

    server.registerTool(
        "save_context",
        {
            description: "Save a piece of personal context for later retrieval.",
            inputSchema: {
                text: z.string().min(1).describe("The context text to save."),
                tags: z.array(z.string()).optional().describe("Optional tags for grouping or filtering the context."),
                source: z.string().optional().describe("Optional source describing where the context came from."),
            },
        },
        async ({ text, tags, source }) => {
            const context = await saveContext(text, tags, source);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ saved: context }),
                    },
                ],
            };
        }
    );

    server.registerTool(
        "search_context",
        {
            description: "Search saved personal context by query.",
            inputSchema: {
                query: z.string().min(1).describe("The search query."),
                limit: z.number().int().positive().optional().describe("Maximum number of context items to return."),
            },
        },
        async ({ query, limit }) => {
            const results = await searchContext(query, limit);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            query,
                            limit: limit ?? 20,
                            results,
                        }),
                    },
                ],
            };
        }
    );

    server.registerTool(
        "list_recent_context",
        {
            description: "List recently saved personal context items.",
            inputSchema: {
                limit: z.number().int().positive().optional().describe("Maximum number of recent context items to return."),
            },
        },
        async ({ limit }) => {
            const results = await listRecentContext(limit);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            limit: limit ?? 20,
                            results,
                        }),
                    },
                ],
            };
        }
    );


    return server;
}
