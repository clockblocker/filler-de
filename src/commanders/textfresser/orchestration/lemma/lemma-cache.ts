import type { ReadContentError } from "@textfresser/vault-action-manager/types/read-content-error";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { ok, type Result } from "neverthrow";
import { stringifySplitPath } from "../../../../stateless-helpers/split-path-comparison";
import { logger } from "../../../../utils/logger";
import { fromLegacyDictEntries } from "../../domain/dict-note";
import { deLanguagePack } from "../../languages/de/pack";
import {
	computeMissingV3SectionKindsFromLemmaResult,
	findEntryForLemmaResult,
	resolveExpectedV3SectionKindsFromLemmaResult,
} from "../../commands/generate/steps/reencounter-sections";
import type { CommandError } from "../../commands/types";
import type { Attestation } from "../../common/attestation/types";
import { dictNoteHelper } from "../../domain/dict-note";
import { cssSuffixFor } from "../../targets/de/sections/section-css-kind";
import type {
	LemmaInvocationCache,
	TextfresserState,
} from "../../state/textfresser-state";

export const LEMMA_IDEMPOTENCE_WINDOW_MS = 10_000;

export function buildLemmaInvocationKey(attestation: Attestation): string {
	const sourcePath = stringifySplitPath(attestation.source.path);
	const offset = attestation.target.offsetInBlock;
	return [
		sourcePath,
		attestation.source.ref,
		attestation.target.surface,
		String(offset ?? "none"),
	].join("::");
}

export function getValidLemmaInvocationCache(
	state: TextfresserState,
	key: string,
): LemmaInvocationCache | null {
	const cache = state.latestLemmaInvocationCache;
	if (!cache) return null;
	if (cache.key !== key) return null;
	const elapsed = Date.now() - cache.cachedAtMs;
	return elapsed <= LEMMA_IDEMPOTENCE_WINDOW_MS ? cache : null;
}

export async function handleLemmaCacheHit(params: {
	cache: LemmaInvocationCache;
	onRefetch: () => void;
	state: TextfresserState;
	readContent: (
		splitPath: SplitPathToMdFile,
	) => Promise<Result<string, ReadContentError>>;
}): Promise<Result<void, CommandError>> {
	const { cache, onRefetch, readContent, state } = params;
	state.latestLemmaResult = cache.lemmaResult;
	state.latestResolvedLemmaTargetPath = cache.resolvedTargetPath;

	const contentResult = await readContent(cache.resolvedTargetPath);
	if (contentResult.isErr()) {
		logger.info("[Textfresser.Lemma] cache-hit read failed, refetching");
		onRefetch();
		return ok(undefined);
	}

	const entries = fromLegacyDictEntries(
		dictNoteHelper.parse(contentResult.value),
		deLanguagePack,
	);
	const matchedEntry = findEntryForLemmaResult({
		entries,
		generatedEntryId: cache.generatedEntryId,
		lemmaResult: cache.lemmaResult,
	});
	if (!matchedEntry) {
		logger.info("[Textfresser.Lemma] cache-hit missing entry, refetching");
		onRefetch();
		return ok(undefined);
	}

	if (
		cache.lemmaResult.linguisticUnit === "Lexeme" &&
		cache.lemmaResult.posLikeKind === "NOUN"
	) {
		logger.info(
			"[Textfresser.Lemma] cache-hit noun entry requires lexical refresh, refetching",
		);
		onRefetch();
		return ok(undefined);
	}

	const missingSections = computeMissingV3SectionKindsForCache({
		entry: matchedEntry,
		lemmaResult: cache.lemmaResult,
	});
	if (missingSections.length === 0) {
		logger.info("[Textfresser.Lemma] cache-hit complete, skipping");
		return ok(undefined);
	}

	logger.info("[Textfresser.Lemma] cache-hit incomplete, refetching");
	onRefetch();
	return ok(undefined);
}

function computeMissingV3SectionKindsForCache(params: {
	entry: Parameters<typeof computeMissingV3SectionKindsFromLemmaResult>[0]["entry"];
	lemmaResult: LemmaInvocationCache["lemmaResult"];
}) {
	const strictMissing = computeMissingV3SectionKindsFromLemmaResult(params);
	if (strictMissing.length === 0) {
		return strictMissing;
	}

	const presentMarkers = new Set(
		params.entry.sections
			.map((section) => section.marker)
			.filter((marker): marker is string => typeof marker === "string"),
	);

	return resolveExpectedV3SectionKindsFromLemmaResult({
		lemmaResult: params.lemmaResult,
	}).filter((sectionKind) => !presentMarkers.has(cssSuffixFor[sectionKind]));
}
