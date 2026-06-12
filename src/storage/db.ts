import pg from "pg";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { PoolConfig } from "pg";

const { Pool } = pg;

function loadDotEnv(envPath = resolve(process.cwd(), ".env")) {
    if (!existsSync(envPath)) {
        return;
    }

    const envFile = readFileSync(envPath, "utf8");

    for (const line of envFile.split(/\r?\n/)) {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith("#")) {
            continue;
        }

        const separatorIndex = trimmedLine.indexOf("=");

        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmedLine.slice(0, separatorIndex).trim();
        let value = trimmedLine.slice(separatorIndex + 1).trim();

        if (!key || process.env[key] !== undefined) {
            continue;
        }

        if (
            (value.startsWith("\"") && value.endsWith("\"")) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
}

function configFromDatabaseUrl(databaseUrl: string): PoolConfig {
    const url = new URL(databaseUrl);
    const config: PoolConfig = {};

    if (url.hostname) {
        config.host = url.hostname;
    }

    if (url.port) {
        config.port = Number.parseInt(url.port, 10);
    }

    if (url.pathname && url.pathname !== "/") {
        config.database = decodeURIComponent(url.pathname.slice(1));
    }

    if (url.username) {
        config.user = decodeURIComponent(url.username);
    }

    if (url.password) {
        config.password = decodeURIComponent(url.password);
    }

    return config;
}

function getDatabaseConfig(): PoolConfig {
    loadDotEnv();

    const databaseUrl = process.env.DATABASE_URL?.trim();
    const config: PoolConfig = databaseUrl ? configFromDatabaseUrl(databaseUrl) : {};

    if (process.env.PGHOST) {
        config.host = process.env.PGHOST;
    }

    if (process.env.PGPORT) {
        config.port = Number.parseInt(process.env.PGPORT, 10);
    }

    if (process.env.PGDATABASE) {
        config.database = process.env.PGDATABASE;
    }

    if (process.env.PGUSER) {
        config.user = process.env.PGUSER;
    }

    if (process.env.PGPASSWORD !== undefined) {
        config.password = process.env.PGPASSWORD;
    }

    if (!config.connectionString && !config.database) {
        throw new Error("Set DATABASE_URL or PGDATABASE in the environment or .env file.");
    }

    return config;
}

export const db = new Pool(getDatabaseConfig());

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

export async function initializeDatabase() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS contexts (
            id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            kind TEXT NOT NULL DEFAULT 'note',
            content TEXT NOT NULL,
            source TEXT,
            tags TEXT[],
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS embeddings (
            context_id BIGINT PRIMARY KEY REFERENCES contexts(id) ON DELETE CASCADE,
            vector TEXT
        )
    `);
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

export async function verifyDatabaseConnection() {
    let client: pg.PoolClient;

    try {
        client = await db.connect();
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("client password must be a string")
        ) {
            throw new Error(
                "Postgres requires password authentication. Add a password to DATABASE_URL or set PGPASSWORD in the environment or .env file.",
                { cause: error }
            );
        }

        throw error;
    }

    try {
        await client.query("SELECT 1");
    } finally {
        client.release();
    }
}

function isDirectRun() {
    if (!process.argv[1]) {
        return false;
    }

    return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

async function main() {
    try {
        await verifyDatabaseConnection();
        console.log("Database connection ok.");
    } finally {
        await db.end();
    }
}

if (isDirectRun()) {
    main().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
