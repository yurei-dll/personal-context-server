# personal-context-server

A personalized context-driven MCP archive server.

ChatGPT, and surely many others have a long-term memories for static facts and user preferences. Obviously, they also have context of the current conversation.

But what if we had a custom layer sit between the two, referencing the user's recent events and overall trends? It would feel more like talking to a friend, rather than a machine we brute forced into learning english and following directions.

This is that layer.

## Scratchpad area

start with only a few tools to expose, and save the embeddings for last!

## Reference area

This section is for keeping track of how the system works internally

### Repo structure

```bash
.
├── package.json
├── package-lock.json
├── README.md
├── data/               tbd
└── src/
  index.ts              starts MCP server
  mcp/
    server.ts           registers tools
  storage/
    db.ts               connection
    schema.ts           tables
    contextRepo.ts      CRUD
  search/
    keywordSearch.ts
    semanticSearch.ts   later
  ingest/
    ingestText.ts
  embeddings/
    embed.ts            later
```

### Exposed tools

```js
save_context(text, tags?, sour)
search_context(query, limit?)
list_recent_context(limit?)
```

### SQL database

Don't overdesign - keep simple!

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
