export type EmbeddingProvider = "none" | "ollama";

export type EmbeddingConfig = {
    enabled: boolean;
    provider: EmbeddingProvider;
    model: string;
    ollamaHost: string;
    autoPull: boolean;
};

function parseEnabled(value: string | undefined) {
    return value?.toLowerCase() === "true";
}

function parseAutoPull(value: string | undefined) {
    return value?.toLowerCase() !== "false";
}

function parseProvider(value: string | undefined): EmbeddingProvider {
    const provider = value?.toLowerCase() ?? "ollama";

    if (provider !== "none" && provider !== "ollama") {
        throw new Error(`Unsupported EMBEDDINGS_PROVIDER: ${value}`);
    }

    return provider;
}

export function getEmbeddingConfig(): EmbeddingConfig {
    const provider = parseProvider(process.env.EMBEDDINGS_PROVIDER);

    return {
        enabled: parseEnabled(process.env.EMBEDDINGS_ENABLED),
        provider,
        model: process.env.EMBEDDINGS_MODEL?.trim() || "nomic-embed-text",
        ollamaHost: process.env.OLLAMA_HOST?.trim() || "http://127.0.0.1:11434",
        autoPull: parseAutoPull(process.env.EMBEDDINGS_AUTO_PULL),
    };
}
