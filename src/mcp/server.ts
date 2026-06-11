import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function save_context(text: string, tags?: string[], source?: string) {
    return {
        text,
        tags: tags ?? [],
        source,
    };
}

function search_context(query: string, limit?: number) {
    const resultLimit = limit ?? 20;

    return {
        query,
        limit: resultLimit,
        results: [],
    };
}

function list_recent_context(limit?: number) {
    const resultLimit = limit ?? 20;

    return {
        limit: resultLimit,
        results: [],
    };
}


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
            const context = save_context(text, tags, source);

            return {
                content: [
                    {
                        type: "text",
                        text: `Saved context: ${JSON.stringify(context)}`,
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
            const results = search_context(query, limit);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(results),
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
            const results = list_recent_context(limit);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(results),
                    },
                ],
            };
        }
    );


    return server;
}
