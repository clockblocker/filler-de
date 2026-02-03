import {
	type AgentOutput,
	PROMPT_FOR,
	SchemasFor,
	type UserInput,
} from "../../prompt-smith";
import type { PromptKind } from "../../prompt-smith/codegen/consts";
import type { ApiService } from "../../stateless-helpers/api-service";
import type { LanguagesConfig } from "../../types";

export class PromptRunner {
	constructor(
		private readonly languages: LanguagesConfig,
		private readonly apiService: ApiService,
	) {}

	async generate<K extends PromptKind>(
		kind: K,
		input: UserInput<K>,
	): Promise<AgentOutput<K>> {
		const prompt =
			PROMPT_FOR[this.languages.target][this.languages.known][kind];
		const schema = SchemasFor[kind].agentOutputSchema;

		// Type assertion needed: SchemasFor uses zod/v3, ApiService uses zod v4
		// The runtime types are compatible but TS can't verify across Zod versions
		const result = await this.apiService.generate({
			// biome-ignore lint/suspicious/noExplicitAny: Zod v3/v4 type mismatch
			schema: schema as any,
			systemPrompt: prompt.systemPrompt,
			userInput: input as string,
			withCache: true,
		});

		return result as AgentOutput<K>;
	}
}
