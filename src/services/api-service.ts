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

export class ApiService {
	private openai: OpenAI | null = null;
	private model = 'gemini-2.5-flash-lite';
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
			console.log(`Error initializing API service: ${error.message}`);
		}
	}

	async generateContent(
		systemPrompt: string,
		userInput: string,
		responseSchema?: boolean
	): Promise<string> {
		try {
			if (!this.openai) {
				throw new Error('OpenAI client not initialized.');
			}

			// tidy system prompt
			systemPrompt = systemPrompt.replace(/^\t+/gm, '');

			const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
				{ role: 'system', content: systemPrompt },
			];

			messages.push({ role: 'user', content: userInput });

			const completion = await this.openai.chat.completions.create({
				model: this.model,
				messages,
				temperature: 0,
				top_p: 0.95,
				max_tokens: responseSchema ? 1024 : 2048,
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
