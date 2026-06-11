// src/storage/db.ts
import pg from "pg";

const { Pool } = pg;

export const db = new Pool({
    connectionString: process.env.DATABASE_URL,
});