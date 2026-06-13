import http from "node:http";
import https from "node:https";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type OllamaModel = {
    name?: string;
    model?: string;
};

type OllamaTagsResponse = {
    models?: OllamaModel[];
};

type OllamaEmbedResponse = {
    embedding?: unknown;
    embeddings?: unknown;
};

type RequestOptions = {
    method?: "GET" | "POST";
    body?: JsonValue;
};

function requestJson<T>(baseUrl: string, path: string, options: RequestOptions = {}) {
    return new Promise<T>((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const body = options.body === undefined ? undefined : JSON.stringify(options.body);
        const transport = url.protocol === "https:" ? https : http;

        const request = transport.request(
            url,
            {
                method: options.method ?? "GET",
                headers: body
                    ? {
                          "content-type": "application/json",
                          "content-length": Buffer.byteLength(body).toString(),
                      }
                    : undefined,
            },
            (response) => {
                let responseBody = "";

                response.setEncoding("utf8");
                response.on("data", (chunk) => {
                    responseBody += chunk;
                });
                response.on("end", () => {
                    if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
                        reject(
                            new Error(
                                `Ollama request failed with status ${response.statusCode}: ${responseBody}`
                            )
                        );
                        return;
                    }

                    if (!responseBody) {
                        resolve({} as T);
                        return;
                    }

                    try {
                        resolve(JSON.parse(responseBody) as T);
                    } catch (error) {
                        reject(new Error("Ollama returned invalid JSON.", { cause: error }));
                    }
                });
            }
        );

        request.on("error", (error) => {
            reject(
                new Error(
                    `Could not reach Ollama at ${baseUrl}. Make sure Ollama is installed and running.`,
                    { cause: error }
                )
            );
        });

        if (body) {
            request.write(body);
        }

        request.end();
    });
}

function isNumberArray(value: unknown): value is number[] {
    return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function getEmbeddingFromResponse(response: OllamaEmbedResponse) {
    if (isNumberArray(response.embedding)) {
        return response.embedding;
    }

    if (Array.isArray(response.embeddings) && isNumberArray(response.embeddings[0])) {
        return response.embeddings[0];
    }

    throw new Error("Ollama did not return an embedding vector.");
}

export async function hasOllamaModel(host: string, model: string) {
    const response = await requestJson<OllamaTagsResponse>(host, "/api/tags");
    const models = response.models ?? [];

    return models.some((availableModel) => {
        const modelName = availableModel.name ?? availableModel.model;

        return modelName === model || modelName === `${model}:latest`;
    });
}

export async function pullOllamaModel(host: string, model: string) {
    await requestJson(host, "/api/pull", {
        method: "POST",
        body: {
            name: model,
            stream: false,
        },
    });
}

export async function generateOllamaEmbedding(
    host: string,
    model: string,
    text: string,
    autoPull: boolean
) {
    const hasModel = await hasOllamaModel(host, model);

    if (!hasModel) {
        if (!autoPull) {
            throw new Error(
                `Ollama model "${model}" is not installed. Run "ollama pull ${model}" or enable EMBEDDINGS_AUTO_PULL.`
            );
        }

        await pullOllamaModel(host, model);
    }

    const response = await requestJson<OllamaEmbedResponse>(host, "/api/embed", {
        method: "POST",
        body: {
            model,
            input: text,
        },
    });

    return getEmbeddingFromResponse(response);
}
