import { describe, expect, it } from "bun:test";
import { ok } from "neverthrow";
import {
	createLexicalGenerationClient,
	LexicalGenerationFailureKind,
	type StructuredFetchFn,
} from "../../src";

describe("createLexicalGenerationClient", () => {
	it("builds generators for the supported German/English phase-1 pair", () => {
		const result = createLexicalGenerationClient({
			fetchStructured: (async () => ok({})) as StructuredFetchFn,
			knownLanguage: "English",
			settings: { generateInflections: true },
			targetLanguage: "German",
		});

		expect(result.isOk()).toBe(true);
		const client = result._unsafeUnwrap();
		expect(typeof client.resolveSelection).toBe("function");
		expect(typeof client.disambiguateSense).toBe("function");
		expect(typeof client.generateLexicalInfo).toBe("function");
		expect(typeof client.generateCore).toBe("function");
	});

	it("fails creation for unsupported language pairs", () => {
		const result = createLexicalGenerationClient({
			fetchStructured: (async () => ok({})) as StructuredFetchFn,
			knownLanguage: "Russian",
			settings: { generateInflections: true },
			targetLanguage: "German",
		});

		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr().kind).toBe(
			LexicalGenerationFailureKind.UnsupportedLanguagePair,
		);
	});
});
