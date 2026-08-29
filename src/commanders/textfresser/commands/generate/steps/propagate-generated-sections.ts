import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	buildLookupCandidates,
	type PathLookupFn,
} from "../../../common/target-path-resolver";
import { resultToEffect } from "../../../orchestration/shared/effect-result";
import { vamIoFailureToCommandError } from "../../../orchestration/shared/vam-failure";
import type { CommandError } from "../../types";
import { decorateAttestationSeparability } from "./decorate-attestation-separability";
import type { GenerateSectionsResult } from "./generate-sections";
import { normalizeLemma } from "./morphology-utils";
import { propagateCore } from "./propagate-core";

function collectLookupBasenames(ctx: GenerateSectionsResult): string[] {
	const basenames = new Set<string>();
	const add = (value: string | null | undefined) => {
		const normalized = value?.trim();
		if (!normalized) return;
		for (const candidate of buildLookupCandidates(normalized)) {
			basenames.add(candidate);
		}
	};

	for (const relation of ctx.relations) {
		for (const word of relation.words) add(word);
	}
	for (const cell of ctx.inflectionCells) add(cell.form);
	for (const morpheme of ctx.morphemes) {
		add(morpheme.linkTarget);
		add(morpheme.lemma);
		add(morpheme.surf);
	}

	const morphology = ctx.morphology;
	if (morphology) {
		add(normalizeLemma(morphology.derivedFromLemma));
		for (const lemma of morphology.compoundedFromLemmas) {
			add(normalizeLemma(lemma));
		}
		add(normalizeLemma(morphology.prefixEquation?.prefixTarget));
	}

	return [...basenames];
}

const loadVaultLookup = Effect.fn("Textfresser.loadPropagationVaultLookup")(
	function* (
		ctx: GenerateSectionsResult,
	): Effect.fn.Return<PathLookupFn, CommandError> {
		const basenames = collectLookupBasenames(ctx);
		const matches = yield* Effect.all(
			basenames.map((basename) =>
				ctx.textfresserState.vam
					.findByBasename(basename)
					.pipe(Effect.mapError(vamIoFailureToCommandError)),
			),
			{ concurrency: "unbounded" },
		);
		const byBasename = new Map<string, SplitPathToMdFile[]>();
		for (let index = 0; index < basenames.length; index += 1) {
			const basename = basenames[index];
			const paths = matches[index];
			if (basename && paths) byBasename.set(basename, paths);
		}
		return (basename) => byBasename.get(basename) ?? [];
	},
);

export const propagateGeneratedSections = Effect.fn(
	"Textfresser.propagateGeneratedSections",
)(function* (
	ctx: GenerateSectionsResult,
): Effect.fn.Return<GenerateSectionsResult, CommandError> {
	const vamLookup = yield* loadVaultLookup(ctx);
	const propagated = yield* resultToEffect(propagateCore(ctx, vamLookup));
	return yield* resultToEffect(decorateAttestationSeparability(propagated));
});
