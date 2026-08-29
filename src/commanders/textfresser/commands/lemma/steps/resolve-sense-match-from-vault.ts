import type {
	ResolvedSelection,
	SenseDisambiguator,
} from "@textfresser/lexical-generation";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import type { VaultActionManager } from "@textfresser/vault-action-manager/facade";
import { Effect } from "effect";
import { logger } from "../../../../../utils/logger";
import { getSpelledLemma } from "../../../domain/native-selection";
import { commandApiError } from "../../../errors";
import { resultToEffect } from "../../../orchestration/shared/effect-result";
import type { CommandError } from "../../types";
import { loadStoredSenseCandidates } from "./load-stored-sense-candidates";

export type SenseMatchFromVault =
	| { matchedIndex: number }
	| { matchedIndex: null; precomputedSenseEmojis?: string[] }
	| null;

export const resolveSenseMatchFromVault = Effect.fn(
	"Textfresser.resolveSenseMatchFromVault",
)(function* (
	vam: VaultActionManager,
	lemma: ResolvedSelection,
	context: string,
	preferredPath?: SplitPathToMdFile,
	options?: { disambiguateWith?: SenseDisambiguator },
): Effect.fn.Return<SenseMatchFromVault, CommandError> {
	const spelledLemma = getSpelledLemma(lemma);
	if (!spelledLemma) {
		return null;
	}
	const storedCandidates = yield* loadStoredSenseCandidates({
		lemma: spelledLemma,
		preferredPath,
		vam,
	});
	if (storedCandidates === null) {
		return null;
	}

	const disambiguateWith = options?.disambiguateWith;
	if (!disambiguateWith) {
		return { matchedIndex: null };
	}

	const moduleResult = yield* Effect.promise(() =>
		disambiguateWith(
			lemma,
			context,
			storedCandidates.map((candidate) => candidate.lexicalMeta),
		),
	);
	const disambiguation = yield* resultToEffect(
		moduleResult.mapErr((error) =>
			commandApiError({
				lexicalGenerationError: error,
				reason: error.message,
			}),
		),
	);

	if (disambiguation.kind === "matched") {
		const matchedCandidate =
			storedCandidates[disambiguation.cacheIndex] ?? null;
		if (!matchedCandidate) {
			logger.warn(
				`[sense-match] cacheIndex ${disambiguation.cacheIndex} out of range - treating as new sense`,
			);
			return { matchedIndex: null };
		}

		return {
			matchedIndex: matchedCandidate.entryIndex,
		};
	}

	return {
		matchedIndex: null,
		precomputedSenseEmojis: disambiguation.precomputedSenseEmojis,
	};
});
