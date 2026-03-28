import { describe, expect, it } from "bun:test";
import { getGeminiApiKey, hasGeminiApiKey } from "./env";
import {
	executeStructuredPromptCase,
	loadLexicalPromptFixtures,
	parseLivePromptSelection,
	resolveLexicalPromptTarget,
} from "./harness";

const apiKey = hasGeminiApiKey() ? getGeminiApiKey() : null;

(apiKey ? describe : describe.skip)(
	"live lexical prompt responses",
	() => {
		it("returns schema-valid output that matches the selected fixture", async () => {
			const selection = parseLivePromptSelection(process.env);
			const prompt = resolveLexicalPromptTarget(selection);
			const fixtures = await loadLexicalPromptFixtures(prompt);
			const example = fixtures[selection.caseIndex - 1];

			if (!example) {
				throw new Error(
					`Fixture #${selection.caseIndex} not found for ${prompt.name}. Available fixtures: ${fixtures.length}`,
				);
			}

			const result = await executeStructuredPromptCase({
				apiKey: apiKey!,
				example,
				prompt,
			});

			expect(result.schemaValid).toBe(true);
			expect(result.matchesExpected).toBe(true);
		});
	},
);
