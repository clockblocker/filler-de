import { describe, expect, it } from "bun:test";
import { moveToWorter } from "../../../../src/commanders/textfresser/commands/generate/steps/move-to-worter";
import type { CommandStateWithLemma } from "../../../../src/commanders/textfresser/commands/types";
import type { TextfresserState } from "../../../../src/commanders/textfresser/state/textfresser-state";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";

function makeCtx(
	params:
		| {
				activePathParts: string[];
				lemma: string;
				linguisticUnit: "Lexem";
				posLikeKind:
					| "Noun"
					| "Pronoun"
					| "Article"
					| "Adjective"
					| "Verb"
					| "Preposition"
					| "Adverb"
					| "Particle"
					| "Conjunction"
					| "InteractionalUnit";
				surfaceKind: "Lemma" | "Inflected" | "Variant";
		  }
		| {
				activePathParts: string[];
				lemma: string;
				linguisticUnit: "Phrasem";
				posLikeKind:
					| "Idiom"
					| "Collocation"
					| "DiscourseFormula"
					| "Proverb"
					| "CulturalQuotation";
				surfaceKind: "Lemma" | "Inflected" | "Variant";
		  },
): CommandStateWithLemma {
	return {
		actions: [],
		commandContext: {
			activeFile: {
				content: "",
				splitPath: {
					basename: params.lemma,
					extension: "md",
					kind: "MdFile",
					pathParts: params.activePathParts,
				},
			},
			selection: null,
		},
		resultingActions: [],
		textfresserState: {
			languages: { known: "English", target: "German" },
			latestLemmaResult:
				params.linguisticUnit === "Lexem"
					? {
							attestation: {
								source: {
									path: {
										basename: "source",
										extension: "md",
										kind: "MdFile",
										pathParts: ["Books"],
									},
									ref: "![[source#^1|^]]",
									textRaw: "raw",
									textWithOnlyTargetMarked: "[word]",
								},
								target: { surface: params.lemma },
							},
							disambiguationResult: null,
							lemma: params.lemma,
							linguisticUnit: "Lexem",
							posLikeKind: params.posLikeKind,
							surfaceKind: params.surfaceKind,
						}
					: {
							attestation: {
								source: {
									path: {
										basename: "source",
										extension: "md",
										kind: "MdFile",
										pathParts: ["Books"],
									},
									ref: "![[source#^1|^]]",
									textRaw: "raw",
									textWithOnlyTargetMarked: "[word]",
								},
								target: { surface: params.lemma },
							},
							disambiguationResult: null,
							lemma: params.lemma,
							linguisticUnit: "Phrasem",
							posLikeKind: params.posLikeKind,
							surfaceKind: params.surfaceKind,
						},
		} as unknown as TextfresserState,
	} as CommandStateWithLemma;
}

describe("moveToWorter policy destination", () => {
	it("moves closed-set lexems to Library destination", () => {
		const ctx = makeCtx({
			activePathParts: ["Worter", "de", "lexem", "lemma", "i", "ich", "ich"],
			lemma: "ich",
			linguisticUnit: "Lexem",
			posLikeKind: "Pronoun",
			surfaceKind: "Lemma",
		});

		const result = moveToWorter(ctx);
		expect(result.isOk()).toBe(true);
		const actions = result._unsafeUnwrap().actions;
		expect(actions).toHaveLength(1);
		const action = actions[0];
		expect(action?.kind).toBe(VaultActionKind.RenameMdFile);

		const payload = action?.payload as {
			to: { pathParts: string[]; basename: string };
		};
		expect(payload.to.pathParts).toEqual(["Library", "de", "pronoun"]);
		expect(payload.to.basename).toBe("ich");
	});

	it("moves open-class entries to Worter destination", () => {
		const ctx = makeCtx({
			activePathParts: ["Library", "de", "verb"],
			lemma: "laufen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Lemma",
		});

		const result = moveToWorter(ctx);
		expect(result.isOk()).toBe(true);
		const action = result._unsafeUnwrap().actions[0];
		expect(action?.kind).toBe(VaultActionKind.RenameMdFile);
		const payload = action?.payload as {
			to: { pathParts: string[]; basename: string };
		};
		expect(payload.to.pathParts[0]).toBe("Worter");
		expect(payload.to.basename).toBe("laufen");
	});

	it("is a no-op when already at destination", () => {
		const ctx = makeCtx({
			activePathParts: ["Library", "de", "pronoun"],
			lemma: "ich",
			linguisticUnit: "Lexem",
			posLikeKind: "Pronoun",
			surfaceKind: "Lemma",
		});

		const result = moveToWorter(ctx);
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().actions).toHaveLength(0);
	});
});
