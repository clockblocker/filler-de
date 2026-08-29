import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import { Effect, Option } from "effect";
import { stringifySplitPath } from "../../../../stateless-helpers/split-path-comparison";
import { logger } from "../../../../utils/logger";
import {
	computeMissingV3SectionKindsFromLemmaResult,
	findEntryForLemmaResult,
	resolveExpectedV3SectionKindsFromLemmaResult,
} from "../../commands/generate/steps/reencounter-sections";
import type { Attestation } from "../../common/attestation/types";
import { dictNoteHelper, fromLegacyDictEntries } from "../../domain/dict-note";
import { deLanguagePack } from "../../languages/de/pack";
import type {
	LemmaInvocationCache,
	TextfresserState,
} from "../../state/textfresser-state";
import { cssSuffixFor } from "../../targets/de/sections/section-css-kind";

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
	nowMs = Date.now(),
): LemmaInvocationCache | null {
	const cache = state.latestLemmaInvocationCache;
	if (!cache) return null;
	if (cache.key !== key) return null;
	const elapsed = nowMs - cache.cachedAtMs;
	return elapsed <= LEMMA_IDEMPOTENCE_WINDOW_MS ? cache : null;
}

export const handleLemmaCacheHit = Effect.fn("Textfresser.handleLemmaCacheHit")(
	function* <E>(params: {
		cache: LemmaInvocationCache;
		onRefetch: () => void;
		state: TextfresserState;
		readContent: (splitPath: SplitPathToMdFile) => Effect.Effect<string, E>;
	}) {
		const { cache, onRefetch, readContent, state } = params;
		state.latestLemmaResult = cache.lemmaResult;
		state.latestResolvedLemmaTargetPath = cache.resolvedTargetPath;

		const contentOption = yield* readContent(cache.resolvedTargetPath).pipe(
			Effect.option,
		);
		if (Option.isNone(contentOption)) {
			logger.info(
				"[Textfresser.Lemma] cache-hit read failed, refetching",
			);
			onRefetch();
			return;
		}

		const entries = fromLegacyDictEntries(
			dictNoteHelper.parse(contentOption.value),
			deLanguagePack,
		);
		const matchedEntry = findEntryForLemmaResult({
			entries,
			generatedEntryId: cache.generatedEntryId,
			lemmaResult: cache.lemmaResult,
		});
		if (!matchedEntry) {
			logger.info(
				"[Textfresser.Lemma] cache-hit missing entry, refetching",
			);
			onRefetch();
			return;
		}

		if (
			cache.lemmaResult.linguisticUnit === "Lexeme" &&
			cache.lemmaResult.posLikeKind === "NOUN"
		) {
			logger.info(
				"[Textfresser.Lemma] cache-hit noun entry requires lexical refresh, refetching",
			);
			onRefetch();
			return;
		}

		const missingSections = computeMissingV3SectionKindsForCache({
			entry: matchedEntry,
			lemmaResult: cache.lemmaResult,
		});
		if (missingSections.length === 0) {
			logger.info("[Textfresser.Lemma] cache-hit complete, skipping");
			return;
		}

		logger.info("[Textfresser.Lemma] cache-hit incomplete, refetching");
		onRefetch();
	},
);

function computeMissingV3SectionKindsForCache(params: {
	entry: Parameters<
		typeof computeMissingV3SectionKindsFromLemmaResult
	>[0]["entry"];
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
