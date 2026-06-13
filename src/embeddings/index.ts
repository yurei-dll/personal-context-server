import { getEmbeddingConfig } from "./config.js";

type EmbeddableContext = {
    id: number;
    content: string;
};

export type EmbeddingSaveResult =
    | {
          saved: false;
          reason: "disabled" | "no_provider";
      }
    | {
          saved: true;
      };

export async function maybeSaveContextEmbedding(
    _context: EmbeddableContext
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

    return {
        saved: true,
    };
}
