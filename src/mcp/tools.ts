import { db, initializeDatabase } from "../storage/db.js";

export type ContextRecord = {
    id: number;
    kind: string;
    content: string;
    source: string | null;
    tags: string[];
    created_at: string;
    updated_at: string;
};

type ContextRow = {
    id: number | string;
    kind: string;
    content: string;
    source: string | null;
    tags: string | string[] | null;
    created_at: string | Date;
    updated_at: string | Date;
};

type DatabaseMetadataRow = {
    context_count: string;
    total_size_bytes: string;
    total_size_pretty: string;
    contexts_size_bytes: string;
    contexts_size_pretty: string;
    embeddings_size_bytes: string;
    embeddings_size_pretty: string;
};

const DEFAULT_CONTEXT_LIMIT = 20;
const MAX_CONTEXT_LIMIT = 100;
let tagsColumnType: string | undefined;

function normalizeLimit(limit?: number) {
    if (limit === undefined) {
        return DEFAULT_CONTEXT_LIMIT;
    }

    return Math.min(Math.max(Math.trunc(limit), 1), MAX_CONTEXT_LIMIT);
}

function parseTags(tags: string | string[] | null) {
    if (!tags) {
        return [];
    }

    if (Array.isArray(tags)) {
        return tags.filter((tag): tag is string => typeof tag === "string");
    }

    try {
        const parsedTags: unknown = JSON.parse(tags);

        if (Array.isArray(parsedTags)) {
            return parsedTags.filter((tag): tag is string => typeof tag === "string");
        }
    } catch {
        // Older rows may have plain text tags. Fall back to comma splitting below.
    }

    return tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function normalizeTimestamp(value: string | Date) {
    return value instanceof Date ? value.toISOString() : value;
}

function mapContextRow(row: ContextRow): ContextRecord {
    return {
        id: Number(row.id),
        kind: row.kind,
        content: row.content,
        source: row.source,
        tags: parseTags(row.tags),
        created_at: normalizeTimestamp(row.created_at),
        updated_at: normalizeTimestamp(row.updated_at),
    };
}

async function getTagsColumnType() {
    if (tagsColumnType) {
        return tagsColumnType;
    }

    const result = await db.query<{ udt_name: string }>(
        `
            SELECT udt_name
            FROM information_schema.columns
            WHERE table_name = 'contexts'
              AND column_name = 'tags'
            LIMIT 1
        `
    );

    tagsColumnType = result.rows[0]?.udt_name ?? "text";

    return tagsColumnType;
}

export async function saveContext(text: string, tags?: string[], source?: string) {
    await initializeDatabase();

    const now = new Date().toISOString();
    const tagList = tags ?? [];
    const tagValue = (await getTagsColumnType()) === "_text" ? tagList : JSON.stringify(tagList);
    const result = await db.query<ContextRow>(
        `
            INSERT INTO contexts (kind, content, source, tags, created_at, updated_at)
            VALUES ('note', $1, $2, $3, $4, $4)
            RETURNING id, kind, content, source, tags, created_at, updated_at
        `,
        [text, source ?? null, tagValue, now]
    );

    return mapContextRow(result.rows[0]);
}

export async function searchContext(query: string, limit?: number) {
    await initializeDatabase();

    const resultLimit = normalizeLimit(limit);
    const searchPattern = `%${query}%`;
    const result = await db.query<ContextRow>(
        `
            SELECT id, kind, content, source, tags, created_at, updated_at
            FROM contexts
            WHERE content ILIKE $1
               OR source ILIKE $1
               OR tags::text ILIKE $1
            ORDER BY created_at DESC, id DESC
            LIMIT $2
        `,
        [searchPattern, resultLimit]
    );

    return result.rows.map(mapContextRow);
}

export async function listRecentContext(limit?: number) {
    await initializeDatabase();

    const result = await db.query<ContextRow>(
        `
            SELECT id, kind, content, source, tags, created_at, updated_at
            FROM contexts
            ORDER BY created_at DESC, id DESC
            LIMIT $1
        `,
        [normalizeLimit(limit)]
    );

    return result.rows.map(mapContextRow);
}

export async function deleteContext(id: number) {
    await initializeDatabase();

    const result = await db.query<ContextRow>(
        `
            DELETE FROM contexts
            WHERE id = $1
            RETURNING id, kind, content, source, tags, created_at, updated_at
        `,
        [id]
    );

    const deletedContext = result.rows[0];

    return deletedContext ? mapContextRow(deletedContext) : null;
}

export async function updateContext(
    id: number,
    text?: string,
    tags?: string[],
    source?: string
) {
    await initializeDatabase();

    const hasText = text !== undefined;
    const hasTags = tags !== undefined;
    const hasSource = source !== undefined;

    if (!hasText && !hasTags && !hasSource) {
        throw new Error("At least one of text, tags, or source must be provided.");
    }

    const tagValue = hasTags
        ? (await getTagsColumnType()) === "_text"
            ? tags
            : JSON.stringify(tags)
        : null;

    const result = await db.query<ContextRow>(
        `
            UPDATE contexts
            SET
                content = CASE WHEN $2 THEN $3 ELSE content END,
                tags = CASE WHEN $4 THEN $5 ELSE tags END,
                source = CASE WHEN $6 THEN $7 ELSE source END,
                updated_at = $8
            WHERE id = $1
            RETURNING id, kind, content, source, tags, created_at, updated_at
        `,
        [
            id,
            hasText,
            text ?? null,
            hasTags,
            tagValue,
            hasSource,
            source ?? null,
            new Date().toISOString(),
        ]
    );

    const updatedContext = result.rows[0];

    return updatedContext ? mapContextRow(updatedContext) : null;
}

export async function getDatabaseMetadata() {
    await initializeDatabase();

    const result = await db.query<DatabaseMetadataRow>(
        `
            SELECT
                (SELECT COUNT(*) FROM contexts) AS context_count,
                pg_database_size(current_database()) AS total_size_bytes,
                pg_size_pretty(pg_database_size(current_database())) AS total_size_pretty,
                pg_total_relation_size('contexts') AS contexts_size_bytes,
                pg_size_pretty(pg_total_relation_size('contexts')) AS contexts_size_pretty,
                pg_total_relation_size('embeddings') AS embeddings_size_bytes,
                pg_size_pretty(pg_total_relation_size('embeddings')) AS embeddings_size_pretty
        `
    );
    const row = result.rows[0];

    return {
        context_count: Number(row?.context_count ?? 0),
        total_size: {
            bytes: Number(row?.total_size_bytes ?? 0),
            pretty: row?.total_size_pretty ?? "0 bytes",
        },
        tables: {
            contexts: {
                bytes: Number(row?.contexts_size_bytes ?? 0),
                pretty: row?.contexts_size_pretty ?? "0 bytes",
            },
            embeddings: {
                bytes: Number(row?.embeddings_size_bytes ?? 0),
                pretty: row?.embeddings_size_pretty ?? "0 bytes",
            },
        },
    };
}
