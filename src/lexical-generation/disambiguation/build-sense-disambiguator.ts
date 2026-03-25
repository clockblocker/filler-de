import { ok } from "neverthrow";
import { executePrompt } from "../internal/prompt-executor";
import type {
	CandidateSense,
	CreateLexicalGenerationModuleParams,
	ResolvedLemma,
	SenseMatchResult,
} from "../public-types";

type IndexedCandidateSense = CandidateSense & {
	promptIndex: number;
};

function matchesLemma(
	lemma: ResolvedLemma,
	candidate: CandidateSense,
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
) {
	return async (
		lemma: ResolvedLemma,
		attestation: string,
		candidateSenses: CandidateSense[],
	) => {
		const matchingCandidates = candidateSenses.filter((candidate) =>
			matchesLemma(lemma, candidate),
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
			})) satisfies IndexedCandidateSense[];

		if (promptCandidates.length === 0) {
			return ok<SenseMatchResult>({ kind: "new" });
		}

		const promptResult = await executePrompt(deps, "Disambiguate", {
			context: attestation,
			lemma: lemma.lemma,
			senses: promptCandidates.map((candidate) => ({
				emojiDescription: candidate.emojiDescription ?? [],
				genus:
					candidate.linguisticUnit === "Lexem" &&
					candidate.posLikeKind === "Noun"
						? candidate.genus
						: undefined,
				index: candidate.promptIndex,
				ipa: candidate.ipa,
				phrasemeKind:
					candidate.linguisticUnit === "Phrasem"
						? candidate.posLikeKind
						: undefined,
				pos:
					candidate.linguisticUnit === "Lexem"
						? candidate.posLikeKind
						: undefined,
				senseGloss: candidate.senseGloss,
				unitKind: candidate.linguisticUnit,
			})),
		});
		if (promptResult.isErr()) {
			return promptResult;
		}

		const matchedCandidate = promptCandidates.find(
			(candidate) =>
				candidate.promptIndex === promptResult.value.matchedIndex,
		);
		if (matchedCandidate) {
			return ok<SenseMatchResult>({
				kind: "matched",
				senseId: matchedCandidate.id,
			});
		}

		return ok<SenseMatchResult>({
			kind: "new",
			precomputedEmojiDescription:
				promptResult.value.emojiDescription ?? undefined,
		});
	};
}
