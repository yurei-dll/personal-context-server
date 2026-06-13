export type EmbeddingProvider = "none";

export type EmbeddingConfig = {
    enabled: boolean;
    provider: EmbeddingProvider;
    model: string | null;
};

function parseEnabled(value: string | undefined) {
    return value?.toLowerCase() === "true";
}

function parseProvider(value: string | undefined): EmbeddingProvider {
    const provider = value?.toLowerCase() ?? "none";

    if (provider !== "none") {
        throw new Error(`Unsupported EMBEDDINGS_PROVIDER: ${value}`);
    }

    return provider;
}

export function getEmbeddingConfig(): EmbeddingConfig {
    return {
        enabled: parseEnabled(process.env.EMBEDDINGS_ENABLED),
        provider: parseProvider(process.env.EMBEDDINGS_PROVIDER),
        model: process.env.EMBEDDINGS_MODEL?.trim() || null,
    };
}
