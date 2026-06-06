# personal-context-server

A personalized context-driven MCP archive server.

ChatGPT, and many others have long-term memories for static facts and user preferences. Obviously, they also have context of the current conversation.

But what if we had a custom layer sit between the two, referencing the user's recent trends and events regardless of the conversation? It would feel more like talking to a friend, rather than a machine we brute forced into learning english and following directions.

This is that layer.

## Roadmap

- [x] Build basic MCP server
- [ ] Build and expose tools
  - [ ] `save_context(text, tags?, source)`
  - [ ] `search_context(query, limit?)`
  - [ ] `list_recent_context(limit?)`

## Reference

This section is for keeping track of how the system works internally

### File structure

```bash
$ tree --gitignore
.
├── package.json
├── package-lock.json
├── README.md
├── src
│   ├── index.ts
│   └── mcp
│       └── server.ts
└── tsconfig.json
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
