import type { ResultAsync } from "neverthrow";
import type {
	ApiService,
	ApiServiceError,
} from "../../../stateless-helpers/api-service";
import type { LanguagesConfig } from "../../../types";
import {
	getPromptOutputSchema,
	getPromptSystemPrompt,
	type PromptInput,
	type PromptKind,
	type PromptOutput,
} from "./prompt-catalog";

export class PromptRunner {
	constructor(
		private readonly languages: LanguagesConfig,
		private readonly apiService: ApiService,
	) {}

	generate<K extends PromptKind>(
		kind: K,
		input: PromptInput<K>,
	): ResultAsync<PromptOutput<K>, ApiServiceError> {
		const systemPrompt = getPromptSystemPrompt({
			kind,
			known: this.languages.known,
			target: this.languages.target,
		});
		const schema = getPromptOutputSchema(kind);

		// Type assertion needed: SchemasFor uses zod/v3, ApiService uses zod v4
		// The runtime types are compatible but TS can't verify across Zod versions
		return this.apiService
			.generate({
				// biome-ignore lint/suspicious/noExplicitAny: Zod v3/v4 type mismatch
				schema: schema as any,
				systemPrompt,
				userInput:
					typeof input === "string" ? input : JSON.stringify(input),
				withCache: true,
			})
			.map((result) => result as PromptOutput<K>);
	}
}
