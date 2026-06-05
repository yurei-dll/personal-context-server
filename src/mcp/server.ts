import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function createServer() {
    const server = new McpServer({
        name: "personal-context-server",
        version: "0.1.0",
    });

    server.tool(
        "ping",
        "Returns pong",
        {},
        async () => {
            return {
                content: [
                    {
                        type: "text",
                        text: "pong",
                    },
                ],
            };
        }
    );

    return server;
}
