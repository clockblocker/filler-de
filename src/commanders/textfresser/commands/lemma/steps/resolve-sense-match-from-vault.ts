import type {
	ResolvedLemma,
	SenseDisambiguator,
} from "@textfresser/lexical-generation";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { err, ok, type Result } from "neverthrow";
import { logger } from "../../../../../utils/logger";
import { commandApiError } from "../../../errors";
import type { CommandError } from "../../types";
import { loadStoredSenseCandidates } from "./load-stored-sense-candidates";

export type SenseMatchFromVault =
	| { matchedIndex: number }
	| { matchedIndex: null; precomputedEmojiDescription?: string[] }
	| null;

export async function resolveSenseMatchFromVault(
	vam: VaultActionManager,
	lemma: ResolvedLemma,
	context: string,
	preferredPath?: SplitPathToMdFile,
	options?: {
		disambiguateWith?: SenseDisambiguator;
	},
): Promise<Result<SenseMatchFromVault, CommandError>> {
	const candidatesResult = await loadStoredSenseCandidates({
		lemma: lemma.lemma,
		preferredPath,
		vam,
	});
	if (candidatesResult.isErr()) {
		return err(candidatesResult.error);
	}

	const storedCandidates = candidatesResult.value;
	if (storedCandidates === null) {
		return ok(null);
	}

	if (!options?.disambiguateWith) {
		return ok({ matchedIndex: null });
	}

	const moduleResult = await options.disambiguateWith(
		lemma,
		context,
		storedCandidates.map((candidate) => candidate.lexicalMeta),
	);
	if (moduleResult.isErr()) {
		return err(
			commandApiError({
				lexicalGenerationError: moduleResult.error,
				reason: moduleResult.error.message,
			}),
		);
	}

	if (moduleResult.value.kind === "matched") {
		const matchedCandidate =
			storedCandidates[moduleResult.value.cacheIndex] ?? null;
		if (!matchedCandidate) {
			logger.warn(
				`[sense-match] cacheIndex ${moduleResult.value.cacheIndex} out of range - treating as new sense`,
			);
			return ok({ matchedIndex: null });
		}

		return ok({
			matchedIndex: matchedCandidate.entryIndex,
		});
	}

	return ok({
		matchedIndex: null,
		precomputedEmojiDescription:
			moduleResult.value.precomputedEmojiDescription,
	});
}
