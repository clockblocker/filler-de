import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { err, ok } from "neverthrow";
import type { GenerateSectionsResult } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import type { CommandInput } from "../../../../src/commanders/textfresser/commands/types";
import { dispatchActions } from "../../../../src/commanders/textfresser/orchestration/shared/dispatch-actions";
import type { VaultActionManager } from "../../../../src/managers/obsidian/vault-action-manager";

const calls = {
	core: 0,
	decorate: 0,
};

let shouldFailCore = false;
let serializeCalls = 0;
let moveCalls = 0;

function okCtx(ctx: unknown) {
	return ok(ctx);
}

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
	"../../../../src/commanders/textfresser/commands/generate/steps/propagate-core",
	() => ({
		propagateCore: (ctx: unknown) => {
			calls.core += 1;
			if (shouldFailCore) {
				return err({
					kind: "ApiError",
					reason: "propagation core failed",
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
	calls.core = 0;
	calls.decorate = 0;
}

function makeCtx(params: {
	linguisticUnit?: "Lexem" | "Phrasem";
	posLikeKind?: string;
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
		},
	} as unknown as GenerateSectionsResult;
}

function makeCommandInput(params: {
	linguisticUnit?: "Lexem" | "Phrasem";
	posLikeKind?: string;
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
		},
	} as unknown as CommandInput;
}

const SAMPLE_SLICES: ReadonlyArray<{
	linguisticUnit: "Lexem" | "Phrasem";
	posLikeKind: string;
	targetLanguage?: "German" | "English";
}> = [
	{ linguisticUnit: "Lexem", posLikeKind: "Noun", targetLanguage: "German" },
	{ linguisticUnit: "Lexem", posLikeKind: "Verb", targetLanguage: "German" },
	{ linguisticUnit: "Phrasem", posLikeKind: "Idiom", targetLanguage: "German" },
	{ linguisticUnit: "Lexem", posLikeKind: "Noun", targetLanguage: "English" },
];

	describe("propagateGeneratedSections", () => {
	beforeEach(() => {
		shouldFailCore = false;
		serializeCalls = 0;
		moveCalls = 0;
		resetCalls();
	});

	afterAll(() => {
		mock.restore();
	});

	it("always routes core propagation and then decorates", async () => {
		const { propagateGeneratedSections } = await import(
			"../../../../src/commanders/textfresser/commands/generate/steps/propagate-generated-sections"
		);

		for (const slice of SAMPLE_SLICES) {
			resetCalls();
			const result = propagateGeneratedSections(
				makeCtx({
					linguisticUnit: slice.linguisticUnit,
					posLikeKind: slice.posLikeKind,
					targetLanguage: slice.targetLanguage,
				}),
			);
			expect(result.isOk()).toBe(true);
			expect(calls.core).toBe(1);
			expect(calls.decorate).toBe(1);
		}
	});

	it("core propagation failure short-circuits Generate with zero emitted/dispatched actions", async () => {
		shouldFailCore = true;
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
			}),
		).andThen((actions) => dispatchActions(vam, actions));

		expect(result.isErr()).toBe(true);
		expect(calls.core).toBe(1);
		expect(calls.decorate).toBe(0);
		expect(serializeCalls).toBe(0);
		expect(moveCalls).toBe(0);
		expect(dispatchCalls).toBe(0);
	});
});
