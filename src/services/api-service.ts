import OpenAI from 'openai';
import { Notice, requestUrl } from 'obsidian';
import { TextEaterSettings } from '../types';
import { prompts } from '../prompts';

function normalizeHeaders(initHeaders?: HeadersInit): Record<string, string> {
	if (!initHeaders) return {};
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

const TTL_SECONDS = 604800;

export class ApiService {
	private openai: OpenAI | null = null;
	private model = 'gemini-2.5-flash-lite';
	private cachedContentIds: Record<string, string> = {};
	private chatSessions: Record<
		string,
		OpenAI.Chat.Completions.ChatCompletion[]
	> = {};

	constructor(private settings: TextEaterSettings) {
		try {
			if (this.settings.apiProvider !== 'google') {
				new Notice('Only Google provider is configured in this build.');
			}
			if (!this.settings.googleApiKey) {
				new Notice('Missing Google API key in settings.');
			}

			function fetchViaObsidian(
				input: RequestInfo,
				init?: RequestInit
			): Promise<Response> {
				const url = typeof input === 'string' ? input : (input as any).url;

				const headers = normalizeHeaders(init?.headers);

				// Ensure Authorization header is there for Google Gemini
				if (!headers['authorization']) {
					headers['authorization'] = `Bearer ${this.settings.googleApiKey}`;
				}

				if (init?.body && !headers['content-type']) {
					headers['content-type'] = 'application/json';
				}

				return requestUrl({
					url,
					method: init?.method as any,
					headers,
					body: init?.body as any,
					throw: false,
				}).then((r) => {
					return new Response(r.text, {
						status: r.status,
						headers: r.headers as any,
					});
				});
			}

			// Initialize OpenAI client with custom fetch
			this.openai = new OpenAI({
				dangerouslyAllowBrowser: true,
				baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
				apiKey: this.settings.googleApiKey,
				fetch: fetchViaObsidian,
			});
		} catch (error: any) {
			new Notice(`Error initializing API service: ${error.message}`);
			console.error(`Error initializing API service: ${error.message}`);
		}
	}

	private async postGoogleApi<T>(path: string, body: any): Promise<T> {
		try {
			const res = await requestUrl({
				url: `https://generativelanguage.googleapis.com/v1beta/${path}`,
				method: 'POST',
				headers: {
					'x-goog-api-key': this.settings.googleApiKey,
					'content-type': 'application/json',
				},
				body: JSON.stringify(body),
				throw: false,
			});

			if (res.status >= 200 && res.status < 300) {
				return JSON.parse(res.text) as T;
			}

			throw new Error(`Google API error ${res.status}: ${res.text}`);
		} catch (err: any) {
			throw new Error(err.message || 'Failed to call Google API');
		}
	}

	private async ensureCachedContentIdForSystemPrompt(
		systemPrompt: string
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
				'cachedContents',
				body
			);

			const id = created?.name;
			if (id) {
				this.cachedContentIds[systemPrompt] = id;
				return id;
			}
		} catch (error) {
			console.warn(
				'CachedContent creation failed; proceeding without cache',
				error
			);
		}
		return null;
	}

	async generateContent(
		systemPrompt: string,
		userInput: string,
		responseSchema?: boolean
	): Promise<string> {
		try {
			if (!this.openai) {
				throw new Error(
					'OpenAI client not initialized. Make shure that you have configured the API key in the settings.'
				);
			}

			// tidy system prompt
			systemPrompt = systemPrompt.replace(/^\t+/gm, '');

			// Try to use Google's CachedContent for the system prompt
			const cachedId =
				await this.ensureCachedContentIdForSystemPrompt(systemPrompt);

			const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
			// If we have a cached system instruction, do not duplicate it in messages
			if (!cachedId) {
				messages.push({ role: 'system', content: systemPrompt });
			}

			messages.push({ role: 'user', content: userInput });
			const completion = await this.openai.chat.completions.create({
				model: this.model,
				messages,
				temperature: 0,
				top_p: 0.95,
				max_tokens: responseSchema ? 1024 : 2048,
				// Pass provider-specific options via extra_body for Google
				...(cachedId
					? {
							// The OpenAI compatibility layer accepts provider extras via extra_body
							extra_body: { google: { cached_content: cachedId } },
						}
					: {}),
			});

			const response = completion.choices?.[0]?.message?.content ?? '';
			return response ?? '';
		} catch (error: any) {
			throw new Error(error.message);
		}
	}

	async fetchTemplate(word: string): Promise<string> {
		const [dictionaryEntry, valenceBlock] = await Promise.all([
			this.generateContent(prompts.generate_dictionary_entry, word),
			this.generateContent(prompts.generate_valence_block, word),
		]);
		return `${dictionaryEntry.replace('<agent_output>', '').replace('</agent_output>', '')}\n\n---\n${valenceBlock}`;
	}

	async determineInfinitiveAndEmoji(word: string): Promise<string> {
		return this.generateContent(
			prompts.determine_infinitive_and_pick_emoji,
			word
		);
	}

	async normalize(text: string): Promise<string> {
		return this.generateContent(prompts.normalize, text);
	}

	async translateText(text: string): Promise<string> {
		return this.generateContent(prompts.translate_de_to_eng, text);
	}

	async consultKeymaker(text: string): Promise<string> {
		return this.generateContent(prompts.keymaker, text);
	}

	async consultC1Richter(text: string): Promise<string> {
		return this.generateContent(prompts.c1Richter, text);
	}

	clearChatSessions(): void {
		this.chatSessions = {};
	}

	getChatSessionCount(): number {
		return Object.keys(this.chatSessions).length;
	}
}
