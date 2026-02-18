import { describe, expect, it } from "bun:test";
import { zodResponseFormat } from "openai/helpers/zod";
import { SchemasFor } from "../../../src/prompt-smith/schemas";

function toOpenAiZodSchema(schema: unknown): Parameters<typeof zodResponseFormat>[0] {
	// Runtime-compatible Zod schema bridge across v3/v4 typings.
	return schema as Parameters<typeof zodResponseFormat>[0];
}

describe("Prompt-smith agent output schemas", () => {
	it("are compatible with strict zodResponseFormat conversion", () => {
		const failures: string[] = [];

		for (const [kind, schemas] of Object.entries(SchemasFor)) {
			try {
				zodResponseFormat(
					toOpenAiZodSchema(schemas.agentOutputSchema),
					"data",
				);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				failures.push(`${kind}: ${message}`);
			}
		}

		expect(failures).toEqual([]);
	});
});
