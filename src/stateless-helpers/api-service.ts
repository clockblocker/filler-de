import { errAsync, ResultAsync } from "neverthrow";
import { Notice, requestUrl } from "obsidian";
import OpenAI, { APIConnectionError, APIError } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import {
	formatError,
	logError,
	logWarning,
} from "../managers/obsidian/vault-action-manager/helpers/issue-handlers";
import type { TextEaterSettings } from "../types";
import { withRetry } from "./retry";

function normalizeHeaders(initHeaders?: HeadersInit): Record<string, string> {
	if (!initHeaders) {
		return {};
	}

	const out: Record<string, string> = {};

	if (initHeaders instanceof Headers) {
		initHeaders.forEach((value, key) => {
			out[key] = value;
		});
	} else if (Array.isArray(initHeaders)) {
		for (const [key, value] of initHeaders) {
			out[key] = value;
		}
	} else {
		// Already a plain object
		Object.assign(out, initHeaders);
	}
	return out;
}

// 7 days
const TTL_SECONDS = 604800;

export type ApiServiceError = { reason: string };

function isRetryableApiError(error: unknown): boolean {
	if (error instanceof APIConnectionError) return true;
	if (error instanceof APIError) {
		return error.status === 429 || (error.status ?? 0) >= 500;
	}
	return false;
}

function toApiServiceError(error: unknown): ApiServiceError {
	return {
		reason:
			error instanceof Error
				? error.message
				: `API call failed: ${String(error)}`,
	};
}

export class ApiService {
	private openai: OpenAI | null = null;
	private model = "gemini-2.5-flash-lite";
	private cachedContentIds: Record<string, string> = {};

	constructor(private settings: TextEaterSettings) {
		try {
			if (this.settings.apiProvider !== "google") {
				new Notice("Only Google provider is configured in this build.");
			}
			if (!this.settings.googleApiKey) {
				new Notice("Missing Google API key in settings.");
			}

			function fetchViaObsidian(
				input: RequestInfo,
				init?: RequestInit,
			): Promise<Response> {
				const url =
					typeof input === "string" ? input : (input as any).url;

				const headers = normalizeHeaders(init?.headers);

				// Ensure Authorization header is there for Google Gemini
				if (!headers.authorization) {
					headers.authorization = `Bearer ${this.settings.googleApiKey}`;
				}

				if (init?.body && !headers["content-type"]) {
					headers["content-type"] = "application/json";
				}

				return requestUrl({
					body: init?.body as any,
					headers,
					method: init?.method as any,
					throw: false,
					url,
				}).then((r) => {
					if (r.status >= 400) {
						logError({
							description: `fetchViaObsidian error: ${r.status} - ${r.text}`,
							location: "ApiService",
						});
					}
					return new Response(r.text, {
						headers: r.headers as any,
						status: r.status,
					});
				});
			}

			// Initialize OpenAI client with custom fetch
			this.openai = new OpenAI({
				apiKey: this.settings.googleApiKey,
				baseURL:
					"https://generativelanguage.googleapis.com/v1beta/openai/",
				dangerouslyAllowBrowser: true,
				fetch: fetchViaObsidian,
			});
		} catch (error: any) {
			logError({
				description: `Error initializing API service: ${error.message}`,
				location: "ApiService",
			});
		}
	}

	private async postGoogleApi<T>(path: string, body: any): Promise<T> {
		try {
			const res = await requestUrl({
				body: JSON.stringify(body),
				headers: {
					"content-type": "application/json",
					"x-goog-api-key": this.settings.googleApiKey,
				},
				method: "POST",
				throw: false,
				url: `https://generativelanguage.googleapis.com/v1beta/${path}`,
			});

			if (res.status >= 200 && res.status < 300) {
				return JSON.parse(res.text) as T;
			}

			throw new Error(`Google API error: ${res.status}: ${res.text}`);
		} catch (error: any) {
			const message = error?.message || "Failed to call Google API";

			// "Cached content is too small" is expected when prompt < 2048 tokens
			const isExpectedCacheError = message.includes(
				"Cached content is too small",
			);
			if (!isExpectedCacheError) {
				logError({ description: message, location: "ApiService" });
			}

			throw error;
		}
	}

	private async ensureCachedContentIdForSystemPrompt(
		systemPrompt: string,
	): Promise<string | null> {
		try {
			const existing = this.cachedContentIds[systemPrompt];
			if (existing) {
				return existing;
			}

			const body = {
				model: `models/${this.model}`,
				systemInstruction: {
					parts: [{ text: systemPrompt }],
				},
				ttl: `${TTL_SECONDS}s`,
			};

			const created = await this.postGoogleApi<{ name?: string }>(
				"cachedContents",
				body,
			);

			const id = created?.name;
			if (id) {
				this.cachedContentIds[systemPrompt] = id;
				return id;
			}
		} catch (___errors) {
			logWarning({
				description:
					"CachedContent creation failed; proceeding without cache",
				location: "ApiService",
			});
		}
		return null;
	}

	generate<T extends z.ZodTypeAny>({
		systemPrompt,
		userInput,
		schema,
		withCache = true,
	}: {
		systemPrompt: string;
		userInput: string;
		schema: T;
		withCache: boolean;
	}): ResultAsync<z.infer<T>, ApiServiceError> {
		if (!this.openai) {
			return errAsync({
				reason: "OpenAI client not initialized. Make sure that you have configured the API key in the settings.",
			});
		}

		const client = this.openai;
		const model = this.model;
		const cleanedPrompt = systemPrompt.replace(/^\t+/gm, "");

		// Cache lookup runs once before the retry loop
		const cachePromise = withCache
			? this.ensureCachedContentIdForSystemPrompt(cleanedPrompt)
			: Promise.resolve(null);

		return ResultAsync.fromPromise(cachePromise, toApiServiceError).andThen(
			(cachedId) => {
				const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
					[];
				if (!cachedId) {
					messages.push({
						content: cleanedPrompt,
						role: "system",
					});
				}
				messages.push({ content: userInput, role: "user" });

				return withRetry(
					async () => {
						const completion = await client.chat.completions.parse({
							messages,
							model,
							// Type assertion needed due to Zod version mismatch between our deps and OpenAI SDK
							response_format: zodResponseFormat(
								schema as unknown as Parameters<
									typeof zodResponseFormat
								>[0],
								"data",
							),
							temperature: 0,
							top_p: 0.95,
							...(cachedId
								? {
										extra_body: {
											google: {
												cached_content: cachedId,
											},
										},
									}
								: {}),
						});

						const parsed = completion.choices?.[0]?.message?.parsed;

						if (parsed) return parsed;

						throw new Error(
							formatError({
								description:
									"Failed to parse response: parsed is undefined",
								location: "ApiService",
							}),
						);
					},
					isRetryableApiError,
					toApiServiceError,
				);
			},
		);
	}
}
