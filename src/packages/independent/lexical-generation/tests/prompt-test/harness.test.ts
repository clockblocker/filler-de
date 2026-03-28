import { describe, expect, it } from "bun:test";
import { z } from "zod/v3";
import {
	executeStructuredPromptCase,
	loadLexicalPromptFixtures,
	parseLivePromptSelection,
	parsePromptSelectionArgs,
	resolveLexicalPromptTarget,
	type StructuredPromptClient,
} from "./harness";

describe("prompt-test harness", () => {
	it("resolves lexical prompt metadata and loads fixtures", async () => {
		const prompt = resolveLexicalPromptTarget({
			knownLanguage: "English",
			promptKind: "Lemma",
			targetLanguage: "German",
		});

		expect(prompt.systemPrompt.length).toBeGreaterThan(0);

		const fixtures = await loadLexicalPromptFixtures(prompt);
		expect(fixtures.length).toBeGreaterThan(0);
		expect(fixtures[0]).toHaveProperty("input");
		expect(fixtures[0]).toHaveProperty("output");
	});

	it("serializes structured input before sending it to the LLM client", async () => {
		let receivedUserInput = "";
		const fakeClient: StructuredPromptClient = async (opts) => {
			receivedUserInput = opts.userInput;
			return {
				durationMs: 7,
				parsed: { ok: true },
				raw: '{"ok":true}',
			};
		};

		const result = await executeStructuredPromptCase({
			apiKey: "test-key",
			client: fakeClient,
			example: {
				input: { surface: "Haus" },
				output: { ok: true },
			},
			prompt: {
				name: "demo",
				schema: z.object({ ok: z.boolean() }),
				systemPrompt: "Return JSON",
			},
		});

		expect(receivedUserInput).toBe(JSON.stringify({ surface: "Haus" }));
		expect(result.schemaValid).toBe(true);
		expect(result.matchesExpected).toBe(true);
	});

	it("marks errored responses as schema-invalid mismatches", async () => {
		const fakeClient: StructuredPromptClient = async () => ({
			durationMs: 11,
			error: "rate limited",
			parsed: null,
			raw: "",
		});

		const result = await executeStructuredPromptCase({
			apiKey: "test-key",
			client: fakeClient,
			example: {
				input: "Haus",
				output: { ok: true },
			},
			prompt: {
				name: "demo",
				schema: z.object({ ok: z.boolean() }),
				systemPrompt: "Return JSON",
			},
		});

		expect(result.schemaValid).toBe(false);
		expect(result.matchesExpected).toBe(false);
		expect(result.error).toBe("rate limited");
	});

	it("parses live prompt selection from env with defaults", () => {
		const selection = parseLivePromptSelection({});

		expect(selection).toEqual({
			caseIndex: 1,
			knownLanguage: "English",
			promptKind: "Lemma",
			targetLanguage: "German",
		});
	});

	it("parses prompt selection from CLI args", () => {
		const selection = parsePromptSelectionArgs(["lemma", "german", "english"]);

		expect(selection).toEqual({
			knownLanguage: "English",
			promptKind: "Lemma",
			targetLanguage: "German",
		});
	});
});
