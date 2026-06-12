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
- [x] Build SQL database and connect to exposed tools
- [ ] Build and expose `metadata` tool that returns db info
- [ ] Branch the tool functions from `db.ts` into `tools.ts`
- [ ] Build database housekeeping functions into `db.ts`

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
