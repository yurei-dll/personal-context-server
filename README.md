# personal-context-server

A personalized context-driven MCP archive server.

ChatGPT, and many others have long-term memories for static facts and user preferences. Obviously, they also have context of the current conversation.

But what if we had a custom layer sit between the two, referencing the user's recent trends and events regardless of the conversation? It would feel more like talking to a friend, rather than a machine we brute forced into learning English and following directions.

This is that layer.

## Example

Long-term memory might know:

- User prefers TypeScript
- User owns a homelab
- User enjoys automation projects

This MCP layer might retrieve:

- User has been building an MCP server this week
- User recently migrated to an RX 7800 XT
- User spent the last month building an Elite Dangerous database

Together, the LLM gains both long-term preferences and recent context _between conversations_.

---

The full LLM runtime situation should look something like this:

<p align=center>User prompt</p>
<p align=center>↓</p>
<p align=center>Conversation context</p>
<p align=center>↓</p>
<p align=center>System prompt</p>
<p align=center>↓</p>
<p align=center>Long-term static memories of user preferences, etc.</p>
<p align=center>↓</p>
<p align=center><b>This MCP layer</b> to fetch recent or trending context outside the current conversation</p>

---

To get started, paste this into your MCP config:

```json
{
  "active": true,
  "args": [
    "/PATH/TO/THIS/REPO/src/index.ts"
  ],
  "command": "tsx",
  "env": {
    "PGHOST": "/var/run/postgresql",
    "PGDATABASE": "DATABASE_NAME",
    "PGUSER": "USERNAME"
  },
  "type": "stdio"
}
```

## Roadmap

- [x] Build basic MCP server
- [x] Build and expose tools
  - [x] `save_context(text, tags?, source?)`
  - [x] `search_context(query, limit?)`
  - [x] `list_recent_context(limit?)`
  - [x] `database_metadata()`
- [x] Build SQL database and connect to exposed tools
- [x] Build and expose `database_metadata` tool that returns db info
- [x] Branch the tool functions from `db.ts` into `tools.ts`
- [ ] Build database housekeeping functions into `db.ts`

## Available tools

| Tool | Usage | Result |
| --- | --- | --- |
| `ping` | Health check for the MCP server. Takes no arguments. | Text response: `Pong!` |
| `save_context` | Save a new personal context note. Arguments: `text` (required string), `tags` (optional string array), `source` (optional string). | JSON text containing `{ "saved": context }`, where `context` is the saved record. |
| `search_context` | Search saved context by text. Arguments: `query` (required string), `limit` (optional positive integer, defaults to `20`, capped at `100`). Searches content, source, and tags. | JSON text containing `{ "query": string, "limit": number, "results": context[] }`, ordered newest first. |
| `list_recent_context` | Fetch recently saved context notes. Arguments: `limit` (optional positive integer, defaults to `20`, capped at `100`). | JSON text containing `{ "limit": number, "results": context[] }`, ordered newest first. |
| `database_metadata` | Fetch simple database metadata. Takes no arguments. | JSON text containing row count, total database size, and table sizes for `contexts` and `embeddings`. Example: `{ "metadata": { "context_count": 3, "total_size": { "bytes": 2147483648, "pretty": "2048 MB" }, "tables": { "contexts": { "bytes": 32768, "pretty": "32 kB" }, "embeddings": { "bytes": 8192, "pretty": "8192 bytes" } } } }`. |

`database_metadata` returns a shape like this:

```json
{
  "metadata": {
    "context_count": 3,
    "total_size": {
      "bytes": 2147483648,
      "pretty": "2048 MB"
    },
    "tables": {
      "contexts": {
        "bytes": 32768,
        "pretty": "32 kB"
      },
      "embeddings": {
        "bytes": 8192,
        "pretty": "8192 bytes"
      }
    }
  }
}
```

Context records returned by the tools look like this:

```json
{
  "id": 1,
  "kind": "note",
  "content": "User has been building an MCP server this week.",
  "source": "chat",
  "tags": ["mcp", "project"],
  "created_at": "2026-06-12T15:00:00.000Z",
  "updated_at": "2026-06-12T15:00:00.000Z"
}
```

## Dev references

### File structure

```bash
$ tree --gitignore
.
├── package.json
├── package-lock.json
├── README.md
├── src
│   ├── index.ts
│   ├── mcp
│   │   └── server.ts
│   └── storage
│       └── db.ts
└── tsconfig.json

4 directories, 7 files
```

### SQL structure

```sql
contexts (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'note',
  content TEXT NOT NULL,
  source TEXT,
  tags TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

embeddings (
  context_id INTEGER PRIMARY KEY,
  vector BLOB or TEXT
)
```
