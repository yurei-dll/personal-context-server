import { getEmbeddingConfig } from "./config.js";
import { generateOllamaEmbedding } from "./providers/ollama.js";
import { db, initializeDatabase } from "../storage/db.js";

type EmbeddableContext = {
    id: number;
    content: string;
};

export type EmbeddingSaveResult =
    | {
          saved: false;
          reason: "disabled" | "no_provider" | "provider_error";
      }
    | {
          saved: true;
          model: string;
          dimensions: number;
      };

async function saveEmbedding(contextId: number, model: string, vector: number[]) {
    await initializeDatabase();

    await db.query(
        `
            INSERT INTO embeddings (context_id, model, vector, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $4)
            ON CONFLICT (context_id) DO UPDATE
            SET
                model = EXCLUDED.model,
                vector = EXCLUDED.vector,
                updated_at = EXCLUDED.updated_at
        `,
        [contextId, model, JSON.stringify(vector), new Date().toISOString()]
    );
}

export async function maybeSaveContextEmbedding(
    context: EmbeddableContext
): Promise<EmbeddingSaveResult> {
    const config = getEmbeddingConfig();

    if (!config.enabled) {
        return {
            saved: false,
            reason: "disabled",
        };
    }

    if (config.provider === "none") {
        return {
            saved: false,
            reason: "no_provider",
        };
    }

    let vector: number[];

    try {
        vector = await generateOllamaEmbedding(
            config.ollamaHost,
            config.model,
            context.content,
            config.autoPull
        );
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);

        return {
            saved: false,
            reason: "provider_error",
        };
    }

    await saveEmbedding(context.id, config.model, vector);

    return {
        saved: true,
        model: config.model,
        dimensions: vector.length,
    };
}
