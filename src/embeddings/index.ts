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

export type EmbeddingGenerateResult =
    | {
          generated: false;
          reason: "disabled" | "no_provider" | "provider_error";
      }
    | {
          generated: true;
          model: string;
          vector: number[];
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
    const embedding = await maybeGenerateEmbedding(context.content);

    if (!embedding.generated) {
        return {
            saved: false,
            reason: embedding.reason,
        };
    }

    await saveEmbedding(context.id, embedding.model, embedding.vector);

    return {
        saved: true,
        model: embedding.model,
        dimensions: embedding.vector.length,
    };
}

export async function maybeGenerateEmbedding(text: string): Promise<EmbeddingGenerateResult> {
    const config = getEmbeddingConfig();

    if (!config.enabled) {
        return {
            generated: false,
            reason: "disabled",
        };
    }

    if (config.provider === "none") {
        return {
            generated: false,
            reason: "no_provider",
        };
    }

    try {
        return {
            generated: true,
            model: config.model,
            vector: await generateOllamaEmbedding(
                config.ollamaHost,
                config.model,
                text,
                config.autoPull
            ),
        };
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);

        return {
            generated: false,
            reason: "provider_error",
        };
    }
}
