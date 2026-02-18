import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { err, ok } from "neverthrow";
import type { CommandInput } from "../../../../src/commanders/textfresser/commands/types";
import { dispatchActions } from "../../../../src/commanders/textfresser/orchestration/shared/dispatch-actions";
import type { VaultActionManager } from "../../../../src/managers/obsidian/vault-action-manager";
import type { GenerateSectionsResult } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";

const calls = {
	decorate: 0,
	inflections: 0,
	morphemes: 0,
	morphology: 0,
	relations: 0,
	v2: 0,
};

let shouldFailV2 = false;
let serializeCalls = 0;
let moveCalls = 0;

function okCtx(ctx: unknown) {
	return ok(ctx);
}

mock.module(
	"../../../../src/commanders/textfresser/commands/generate/steps/propagate-relations",
	() => ({
		propagateRelations: (ctx: unknown) => {
			calls.relations += 1;
			return okCtx(ctx);
		},
	}),
);

mock.module(
	"../../../../src/commanders/textfresser/commands/generate/steps/propagate-morphology-relations",
	() => ({
		propagateMorphologyRelations: (ctx: unknown) => {
			calls.morphology += 1;
			return okCtx(ctx);
		},
	}),
);

mock.module(
	"../../../../src/commanders/textfresser/commands/generate/steps/propagate-morphemes",
	() => ({
		propagateMorphemes: (ctx: unknown) => {
			calls.morphemes += 1;
			return okCtx(ctx);
		},
	}),
);

mock.module(
	"../../../../src/commanders/textfresser/commands/generate/steps/decorate-attestation-separability",
	() => ({
		decorateAttestationSeparability: (ctx: unknown) => {
			calls.decorate += 1;
			return okCtx(ctx);
		},
	}),
);

mock.module(
	"../../../../src/commanders/textfresser/commands/generate/steps/propagate-inflections",
	() => ({
		propagateInflections: (ctx: unknown) => {
			calls.inflections += 1;
			return okCtx(ctx);
		},
	}),
);

mock.module(
	"../../../../src/commanders/textfresser/commands/generate/steps/propagate-v2",
	() => ({
		propagateV2: (ctx: unknown) => {
			calls.v2 += 1;
			if (shouldFailV2) {
				return err({
					kind: "ApiError",
					reason: "propagation v2 failed",
				});
			}
			return okCtx(ctx);
		},
	}),
);

mock.module(
	"../../../../src/commanders/textfresser/commands/generate/steps/check-attestation",
	() => ({
		checkAttestation: <T>(state: T) => okCtx(state),
	}),
);

mock.module(
	"../../../../src/commanders/textfresser/commands/generate/steps/check-eligibility",
	() => ({
		checkEligibility: <T>(state: T) => okCtx(state),
	}),
);

mock.module(
	"../../../../src/commanders/textfresser/commands/generate/steps/check-lemma-result",
	() => ({
		checkLemmaResult: <T>(state: T) => okCtx(state),
	}),
);

mock.module(
	"../../../../src/commanders/textfresser/commands/generate/steps/resolve-existing-entry",
	() => ({
		resolveExistingEntry: <T>(state: T) => okCtx(state),
	}),
);

mock.module(
	"../../../../src/commanders/textfresser/commands/generate/steps/generate-sections",
	() => ({
		generateSections: <T>(state: T) => okCtx(state),
	}),
);

mock.module(
	"../../../../src/commanders/textfresser/commands/generate/steps/serialize-entry",
	() => ({
		serializeEntry: <T>(state: T) => {
			serializeCalls += 1;
			return okCtx(state);
		},
	}),
);

mock.module(
	"../../../../src/commanders/textfresser/commands/generate/steps/move-to-worter",
	() => ({
		moveToWorter: <T>(state: T) => {
			moveCalls += 1;
			return okCtx(state);
		},
	}),
);

function resetCalls() {
	calls.decorate = 0;
	calls.inflections = 0;
	calls.morphemes = 0;
	calls.morphology = 0;
	calls.relations = 0;
	calls.v2 = 0;
}

function makeCtx(params: {
	linguisticUnit?: "Lexem" | "Phrasem";
	posLikeKind?: string;
	propagationV2Enabled: boolean;
	targetLanguage?: "German" | "English";
}): GenerateSectionsResult {
	const posLikeKind = params.posLikeKind ?? "Noun";
	const linguisticUnit = params.linguisticUnit ?? "Lexem";
	const targetLanguage = params.targetLanguage ?? "German";
	return {
		actions: [],
		textfresserState: {
			languages: { known: "English", target: targetLanguage },
			latestLemmaResult: {
				attestation: { source: { ref: "![[src#^1|^]]" } },
				disambiguationResult: null,
				lemma: "Haus",
				linguisticUnit,
				posLikeKind,
				surfaceKind: "Lemma",
			},
			propagationV2Enabled: params.propagationV2Enabled,
		},
	} as unknown as GenerateSectionsResult;
}

function makeCommandInput(params: {
	linguisticUnit?: "Lexem" | "Phrasem";
	posLikeKind?: string;
	propagationV2Enabled: boolean;
	targetLanguage?: "German" | "English";
}): CommandInput {
	const posLikeKind = params.posLikeKind ?? "Noun";
	const linguisticUnit = params.linguisticUnit ?? "Lexem";
	const targetLanguage = params.targetLanguage ?? "German";

	return {
		commandContext: {
			activeFile: {
				content: "",
				splitPath: {
					basename: "gehen",
					extension: "md",
					kind: "MdFile",
					pathParts: ["Worter", "de"],
				},
			},
			selection: null,
		},
		resultingActions: [],
		textfresserState: {
			languages: { known: "English", target: targetLanguage },
			latestLemmaResult: {
				attestation: { source: { ref: "![[src#^1|^]]" } },
				disambiguationResult: null,
				lemma: "Haus",
				linguisticUnit,
				posLikeKind,
				surfaceKind: "Lemma",
			},
			propagationV2Enabled: params.propagationV2Enabled,
		},
	} as unknown as CommandInput;
}

const MIGRATED_NON_VERB_SLICES: ReadonlyArray<{
	linguisticUnit: "Lexem" | "Phrasem";
	posLikeKind: string;
	sliceKey: string;
}> = [
	{
		linguisticUnit: "Lexem",
		posLikeKind: "Adjective",
		sliceKey: "de/lexem/adjective",
	},
	{ linguisticUnit: "Lexem", posLikeKind: "Adverb", sliceKey: "de/lexem/adverb" },
	{ linguisticUnit: "Lexem", posLikeKind: "Article", sliceKey: "de/lexem/article" },
	{
		linguisticUnit: "Lexem",
		posLikeKind: "Conjunction",
		sliceKey: "de/lexem/conjunction",
	},
	{
		linguisticUnit: "Lexem",
		posLikeKind: "InteractionalUnit",
		sliceKey: "de/lexem/interactionalunit",
	},
	{ linguisticUnit: "Lexem", posLikeKind: "Noun", sliceKey: "de/lexem/noun" },
	{ linguisticUnit: "Lexem", posLikeKind: "Particle", sliceKey: "de/lexem/particle" },
	{
		linguisticUnit: "Lexem",
		posLikeKind: "Preposition",
		sliceKey: "de/lexem/preposition",
	},
	{ linguisticUnit: "Lexem", posLikeKind: "Pronoun", sliceKey: "de/lexem/pronoun" },
	{
		linguisticUnit: "Phrasem",
		posLikeKind: "Collocation",
		sliceKey: "de/phrasem/collocation",
	},
	{
		linguisticUnit: "Phrasem",
		posLikeKind: "CulturalQuotation",
		sliceKey: "de/phrasem/culturalquotation",
	},
	{
		linguisticUnit: "Phrasem",
		posLikeKind: "DiscourseFormula",
		sliceKey: "de/phrasem/discourseformula",
	},
	{ linguisticUnit: "Phrasem", posLikeKind: "Idiom", sliceKey: "de/phrasem/idiom" },
	{ linguisticUnit: "Phrasem", posLikeKind: "Proverb", sliceKey: "de/phrasem/proverb" },
];

describe("propagateGeneratedSections", () => {
	beforeEach(() => {
		shouldFailV2 = false;
		serializeCalls = 0;
		moveCalls = 0;
		resetCalls();
	});

	afterAll(() => {
		mock.restore();
	});

	it("runs legacy v1 chain when kill-switch is false", async () => {
		const { propagateGeneratedSections } = await import(
			"../../../../src/commanders/textfresser/commands/generate/steps/propagate-generated-sections"
		);

		const result = propagateGeneratedSections(
			makeCtx({
				propagationV2Enabled: false,
			}),
		);
		expect(result.isOk()).toBe(true);
		expect(calls.relations).toBe(1);
		expect(calls.morphology).toBe(1);
		expect(calls.morphemes).toBe(1);
		expect(calls.decorate).toBe(1);
		expect(calls.inflections).toBe(1);
		expect(calls.v2).toBe(0);
	});

	it("routes every migrated non-verb slice to v2 when kill-switch is true", async () => {
		const { propagateGeneratedSections } = await import(
			"../../../../src/commanders/textfresser/commands/generate/steps/propagate-generated-sections"
		);

		for (const slice of MIGRATED_NON_VERB_SLICES) {
			resetCalls();
			const result = propagateGeneratedSections(
				makeCtx({
					linguisticUnit: slice.linguisticUnit,
					posLikeKind: slice.posLikeKind,
					propagationV2Enabled: true,
				}),
			);
			expect(result.isOk()).toBe(true);
			expect(calls.v2).toBe(1);
			expect(calls.relations).toBe(0);
			expect(calls.morphology).toBe(0);
			expect(calls.morphemes).toBe(0);
			expect(calls.decorate).toBe(1);
			expect(calls.inflections).toBe(0);
		}
	});

	it("falls back to legacy v1 chain for non-migrated slice when kill-switch is true", async () => {
		const { propagateGeneratedSections } = await import(
			"../../../../src/commanders/textfresser/commands/generate/steps/propagate-generated-sections"
		);

		const result = propagateGeneratedSections(
			makeCtx({
				posLikeKind: "Verb",
				propagationV2Enabled: true,
			}),
		);
		expect(result.isOk()).toBe(true);
		expect(calls.v2).toBe(0);
		expect(calls.relations).toBe(1);
		expect(calls.morphology).toBe(1);
		expect(calls.morphemes).toBe(1);
		expect(calls.decorate).toBe(1);
		expect(calls.inflections).toBe(1);
	});

	it("v2 failure short-circuits Generate with zero emitted/dispatched actions", async () => {
		shouldFailV2 = true;
		const { generateCommand } = await import(
			"../../../../src/commanders/textfresser/commands/generate/generate-command"
		);
		let dispatchCalls = 0;
		const vam = {
			dispatch: async () => {
				dispatchCalls += 1;
				return ok(undefined);
			},
		} as unknown as VaultActionManager;

		const result = await generateCommand(
			makeCommandInput({
				posLikeKind: "Noun",
				propagationV2Enabled: true,
			}),
		).andThen((actions) => dispatchActions(vam, actions));

		expect(result.isErr()).toBe(true);
		expect(calls.v2).toBe(1);
		expect(calls.decorate).toBe(0);
		expect(serializeCalls).toBe(0);
		expect(moveCalls).toBe(0);
		expect(dispatchCalls).toBe(0);
	});
});
