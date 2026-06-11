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
