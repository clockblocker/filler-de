import { describe, expect, it } from "bun:test";
import { ok } from "neverthrow";
import {
	createLexicalGenerationModule,
	LexicalGenerationFailureKind,
	type StructuredFetchFn,
} from "../../src/index";

describe("createLexicalGenerationModule", () => {
	it("builds generators for a supported language pair", () => {
		const result = createLexicalGenerationModule({
			fetchStructured: (async () => ok({})) as StructuredFetchFn,
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		});

		expect(result.isOk()).toBe(true);
		const module = result._unsafeUnwrap();
		expect(typeof module.resolveSelection).toBe("function");
		expect(typeof module.disambiguateSense).toBe("function");
		expect(typeof module.generateLexicalInfo).toBe("function");
	});

	it("fails creation for an unsupported language pair", () => {
		const result = createLexicalGenerationModule({
			fetchStructured: (async () => ok({})) as StructuredFetchFn,
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
