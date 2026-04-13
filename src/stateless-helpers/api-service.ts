import {
	formatError,
	logError,
} from "@textfresser/vault-action-manager";
import { errAsync, ResultAsync } from "neverthrow";
import { Notice, requestUrl } from "obsidian";
import OpenAI, { APIConnectionError, APIError } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import type { TextEaterSettings } from "../types";
import { getErrorMessage } from "../utils/get-error-message";
import { logger } from "../utils/logger";
import { withRetry } from "./retry";

const REQUEST_LABEL_HEADER = "x-textfresser-request-label";

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

function takeHeader(
	headers: Record<string, string>,
	headerName: string,
): string | undefined {
	const match = Object.keys(headers).find(
		(key) => key.toLowerCase() === headerName.toLowerCase(),
	);
	if (!match) {
		return undefined;
	}

	const value = headers[match];
	delete headers[match];
	return value;
}

// 7 days
const TTL_SECONDS = 604800;
const GENERATE_TIMEOUT_MS = 45_000;

class ApiTimeoutError extends Error {
	constructor(timeoutMs: number) {
		super(`API request timed out after ${timeoutMs}ms`);
		this.name = "ApiTimeoutError";
	}
}

export type ApiServiceError = { reason: string };

function isRetryableApiError(error: unknown): boolean {
	if (error instanceof ApiTimeoutError) return true;
	if (error instanceof APIConnectionError) return true;
	if (error instanceof APIError) {
		return error.status === 429 || (error.status ?? 0) >= 500;
	}
	return false;
}

function toApiServiceError(
	error: unknown,
	requestLabel?: string,
): ApiServiceError {
	const reason = getErrorMessage(error);
	return {
		reason: requestLabel ? `[prompt:${requestLabel}] ${reason}` : reason,
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

			const googleApiKey = this.settings.googleApiKey;
			const fetchViaObsidian = async (
				input: string | URL | Request,
				init?: RequestInit,
			): Promise<Response> => {
				const url =
					typeof input === "string"
						? input
						: input instanceof URL
							? input.toString()
							: input.url;

				const headers = normalizeHeaders(init?.headers);
				const requestLabel = takeHeader(headers, REQUEST_LABEL_HEADER);

				// Ensure Authorization header is there for Google Gemini
				if (!headers.authorization) {
					headers.authorization = `Bearer ${googleApiKey}`;
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
							description: `fetchViaObsidian error${
								requestLabel ? ` [prompt:${requestLabel}]` : ""
							}: ${r.status} - ${r.text}`,
							location: "ApiService",
						});
				};
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
		} catch (error) {
			logError({
				description: `Error initializing API service: ${getErrorMessage(error)}`,
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
		} catch (error) {
			const message =
				getErrorMessage(error) || "Failed to call Google API";

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
		const CACHE_TIMEOUT_MS = 3000;

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

			const created = await Promise.race([
				this.postGoogleApi<{ name?: string }>("cachedContents", body),
				new Promise<null>((resolve) =>
					setTimeout(() => resolve(null), CACHE_TIMEOUT_MS),
				),
			]);

			const id = created?.name;
			if (id) {
				this.cachedContentIds[systemPrompt] = id;
				return id;
			}
		} catch (___errors) {
			logger.info(
				"[Textfresser] [ApiService]: CachedContent creation failed; proceeding without cache",
			);
		}
		return null;
	}

	private async withTimeout<T>(
		promise: Promise<T>,
		timeoutMs: number,
	): Promise<T> {
		let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
		try {
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutHandle = setTimeout(() => {
					reject(new ApiTimeoutError(timeoutMs));
				}, timeoutMs);
			});
			return await Promise.race([promise, timeoutPromise]);
		} finally {
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
		}
	}

	generate<T extends z.ZodTypeAny>({
		requestLabel,
		systemPrompt,
		userInput,
		schema,
		withCache = true,
	}: {
		requestLabel?: string;
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

		return ResultAsync.fromPromise(cachePromise, (error) =>
			toApiServiceError(error, requestLabel),
		).andThen((cachedId) => {
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
					const completion = await this.withTimeout(
						client.chat.completions.parse(
							{
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
							},
							requestLabel
								? {
										headers: {
											[REQUEST_LABEL_HEADER]:
												requestLabel,
										},
									}
								: undefined,
						),
						GENERATE_TIMEOUT_MS,
					);

					const parsed = completion.choices?.[0]?.message?.parsed;

					if (parsed) return parsed;

					throw new Error(
						formatError({
							description: `Failed to parse response${
								requestLabel
									? ` for prompt ${requestLabel}`
									: ""
							}: parsed is undefined`,
							location: "ApiService",
						}),
					);
				},
				isRetryableApiError,
				(error) => toApiServiceError(error, requestLabel),
			);
		});
	}
}
