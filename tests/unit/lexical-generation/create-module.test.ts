import { describe, expect, it } from "bun:test";
import { ok } from "neverthrow";
import {
	createLexicalGenerationModule,
	LexicalGenerationFailureKind,
} from "../../../src/lexical-generation";

describe("createLexicalGenerationModule", () => {
	it("builds generators for a supported language pair", () => {
		const result = createLexicalGenerationModule({
			fetchStructured: async () => ok({}),
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		});

		expect(result.isOk()).toBe(true);
		const module = result._unsafeUnwrap();
		expect(typeof module.buildLemmaGenerator).toBe("function");
		expect(typeof module.buildSenseDisambiguator).toBe("function");
		expect(typeof module.buildLexicalInfoGenerator).toBe("function");
	});

	it("fails creation for an unsupported language pair", () => {
		const result = createLexicalGenerationModule({
			fetchStructured: async () => ok({}),
			knownLang: "German" as never,
			settings: { generateInflections: true },
			targetLang: "German",
		});

		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr().kind).toBe(
			LexicalGenerationFailureKind.UnsupportedLanguagePair,
		);
	});
});
