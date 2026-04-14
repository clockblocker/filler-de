import { err, ok } from "neverthrow";
import { LexicalGenerationFailureKind, lexicalGenerationError } from "./errors";
import { executePrompt } from "./internal/prompt-executor";
import { operationRegistry } from "./internal/prompt-registry";
import { createLexicalIdentityFromSelection } from "./lexical-meta";
import type {
	CreateLexicalGenerationClientParams,
	LexicalMeta,
	ResolvedSelection,
	SenseDisambiguator,
	SenseMatchResult,
} from "./public-types";
import { getSpelledLemma, isKnownSelection } from "./selection-helpers";

type IndexedLexicalMeta = LexicalMeta & {
	cacheIndex: number;
	promptIndex: number;
};

function sameIdentity(
	left: LexicalMeta["identity"],
	right: LexicalMeta["identity"],
) {
	return (
		left.lemmaKind === right.lemmaKind &&
		left.discriminator === right.discriminator &&
		left.surfaceKind === right.surfaceKind
	);
}

function normalizeCandidates(
	selection: ResolvedSelection,
	candidateSenses: LexicalMeta[],
) {
	const selectionIdentity = createLexicalIdentityFromSelection(selection, {
		normalizeToLemma: true,
	});
	if (!selectionIdentity) {
		return null;
	}

	return candidateSenses
		.map((candidate, cacheIndex) => ({ ...candidate, cacheIndex }))
		.filter((candidate) =>
			sameIdentity(candidate.identity, selectionIdentity),
		)
		.filter(
			(candidate) =>
				Array.isArray(candidate.senseEmojis) &&
				candidate.senseEmojis.length > 0,
		)
		.map((candidate, index) => ({
			...candidate,
			promptIndex: index + 1,
		})) satisfies IndexedLexicalMeta[];
}

export function buildSenseDisambiguator(
	deps: Pick<
		CreateLexicalGenerationClientParams,
		"fetchStructured" | "knownLanguage" | "targetLanguage"
	>,
): SenseDisambiguator {
	return async (selection, attestation, candidateSenses) => {
		if (!isKnownSelection(selection)) {
			return err(
				lexicalGenerationError(
					LexicalGenerationFailureKind.InvalidSelection,
					"disambiguateSense requires a known selection",
				),
			);
		}

		const matchingCandidates = normalizeCandidates(
			selection,
			candidateSenses,
		);
		if (!matchingCandidates || matchingCandidates.length === 0) {
			return ok<SenseMatchResult>({ kind: "new" });
		}

		const promptResult = await executePrompt(
			deps,
			operationRegistry.disambiguateSense,
			{
				attestation,
				lemma: getSpelledLemma(selection) ?? "",
				senses: matchingCandidates.map((candidate) => ({
					senseEmojis: candidate.senseEmojis,
					identity: {
						discriminator: candidate.identity.discriminator,
						lemmaKind: candidate.identity.lemmaKind,
						surfaceKind: candidate.identity.surfaceKind,
					},
					index: candidate.promptIndex,
				})),
			},
		);
		if (promptResult.isErr()) {
			return err(promptResult.error);
		}

		if (promptResult.value.matchedIndex !== null) {
			const matched = matchingCandidates.find(
				(candidate) =>
					candidate.promptIndex === promptResult.value.matchedIndex,
			);
			if (matched) {
				return ok<SenseMatchResult>({
					cacheIndex: matched.cacheIndex,
					kind: "matched",
				});
			}
		}

		return ok<SenseMatchResult>({
			kind: "new",
			precomputedSenseEmojis:
				promptResult.value.senseEmojis ?? undefined,
		});
	};
}
