import { describe, expect, it } from "bun:test";
import { okAsync } from "neverthrow";
import { PromptRunner } from "../../../../src/commanders/textfresser/llm/prompt-runner";
import { PromptKind } from "../../../../src/lexical-generation/internal/prompt-smith/codegen/consts";
import type { ApiService } from "../../../../src/stateless-helpers/api-service";

describe("PromptRunner", () => {
	it("passes prompt kind as request label to ApiService", () => {
		const requests: Array<Record<string, unknown>> = [];
		const apiService = {
			generate: (params: Record<string, unknown>) => {
				requests.push(params);
				return okAsync("translated");
			},
		} as unknown as ApiService;

		const runner = new PromptRunner(
			{ known: "English", target: "German" },
			apiService,
		);

		runner.generate(PromptKind.Translate, "Guten Morgen");

		expect(requests).toHaveLength(1);
		expect(requests[0]?.requestLabel).toBe(PromptKind.Translate);
	});
});
