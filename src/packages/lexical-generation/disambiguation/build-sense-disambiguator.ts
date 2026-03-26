import { err, ok } from "neverthrow";
import { executePrompt } from "../internal/prompt-executor";
import { parseLexicalMetaTag } from "../lexical-meta";
import type {
	CreateLexicalGenerationModuleParams,
	LexicalMeta,
	ResolvedLemma,
	SenseDisambiguator,
	SenseMatchResult,
} from "../public-types";

type IndexedLexicalMeta = LexicalMeta & {
	cacheIndex: number;
	parsedMetaTag: NonNullable<ReturnType<typeof parseLexicalMetaTag>>;
	promptIndex: number;
};

function matchesLemma(
	lemma: ResolvedLemma,
	candidate: NonNullable<ReturnType<typeof parseLexicalMetaTag>>,
): boolean {
	if (lemma.linguisticUnit !== candidate.linguisticUnit) {
		return false;
	}
	return lemma.posLikeKind === candidate.posLikeKind;
}

export function buildSenseDisambiguator(
	deps: Pick<
		CreateLexicalGenerationModuleParams,
		"fetchStructured" | "knownLang" | "targetLang"
	>,
): SenseDisambiguator {
	return async (
		lemma: ResolvedLemma,
		attestation: string,
		candidateSenses: LexicalMeta[],
	) => {
		const matchingCandidates = candidateSenses
			.map((candidate, cacheIndex) => {
				const parsedMetaTag = parseLexicalMetaTag(candidate.metaTag);
				if (!parsedMetaTag) {
					return null;
				}

				return {
					...candidate,
					cacheIndex,
					parsedMetaTag,
				};
			})
			.filter((candidate) => candidate !== null)
			.filter(
				(candidate) => candidate.parsedMetaTag.surfaceKind === "Lemma",
			)
			.filter((candidate) =>
				matchesLemma(lemma, candidate.parsedMetaTag),
			);

		if (matchingCandidates.length === 0) {
			return ok<SenseMatchResult>({ kind: "new" });
		}

		const promptCandidates = matchingCandidates
			.filter(
				(candidate) =>
					Array.isArray(candidate.emojiDescription) &&
					candidate.emojiDescription.length > 0,
			)
			.map((candidate, index) => ({
				...candidate,
				promptIndex: index + 1,
			})) satisfies IndexedLexicalMeta[];

		if (promptCandidates.length === 0) {
			return ok<SenseMatchResult>({ kind: "new" });
		}

		const promptResult = await executePrompt(deps, "Disambiguate", {
			context: attestation,
			lemma: lemma.lemma,
			senses: promptCandidates.map((candidate) => ({
				emojiDescription: candidate.emojiDescription ?? [],
				index: candidate.promptIndex,
				phrasemeKind:
					candidate.parsedMetaTag.linguisticUnit === "Phrasem"
						? candidate.parsedMetaTag.posLikeKind
						: undefined,
				pos:
					candidate.parsedMetaTag.linguisticUnit === "Lexem"
						? candidate.parsedMetaTag.posLikeKind
						: undefined,
				unitKind: candidate.parsedMetaTag.linguisticUnit,
			})),
		});
		if (promptResult.isErr()) {
			return err(promptResult.error);
		}

		const matchedCandidate = promptCandidates.find(
			(candidate) =>
				candidate.promptIndex === promptResult.value.matchedIndex,
		);
		if (matchedCandidate) {
			return ok<SenseMatchResult>({
				cacheIndex: matchedCandidate.cacheIndex,
				kind: "matched",
			});
		}

		return ok<SenseMatchResult>({
			kind: "new",
			precomputedEmojiDescription:
				promptResult.value.emojiDescription ?? undefined,
		});
	};
}
