import { err, ok } from "neverthrow";
import { executePrompt } from "../internal/prompt-executor";
import { parseLexicalMetaTag } from "../lexical-meta";
import type {
	CreateLexicalGenerationModuleParams,
	LexicalMeta,
	ResolvedSelection,
	SenseDisambiguator,
	SenseMatchResult,
} from "../public-types";
import {
	getLemmaKind,
	getSelectionDiscriminator,
	getSpelledLemma,
	isKnownSelection,
} from "../selection-helpers";

const LEGACY_UNIT_KIND_FROM_NATIVE = {
	Lexeme: "Lexem",
	Morpheme: "Morphem",
	Phraseme: "Phrasem",
} as const;

const LEGACY_PHRASEME_KIND_FROM_NATIVE = {
	Aphorism: "Proverb",
	Cliché: "Idiom",
	DiscourseFormula: "DiscourseFormula",
} as const;

type IndexedLexicalMeta = LexicalMeta & {
	cacheIndex: number;
	parsedMetaTag: NonNullable<ReturnType<typeof parseLexicalMetaTag>>;
	promptIndex: number;
};

function matchesLemma(
	selection: ResolvedSelection,
	candidate: NonNullable<ReturnType<typeof parseLexicalMetaTag>>,
): boolean {
	if (!isKnownSelection(selection)) {
		return false;
	}
	if (getLemmaKind(selection) !== candidate.lemmaKind) {
		return false;
	}
	return getSelectionDiscriminator(selection) === candidate.discriminator;
}

export function buildSenseDisambiguator(
	deps: Pick<
		CreateLexicalGenerationModuleParams,
		"fetchStructured" | "knownLang" | "targetLang"
	>,
): SenseDisambiguator {
	return async (
		selection: ResolvedSelection,
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
				matchesLemma(selection, candidate.parsedMetaTag),
			);

		if (matchingCandidates.length === 0) {
			return ok<SenseMatchResult>({ kind: "new" });
		}

		const promptCandidates = matchingCandidates
			.filter(
				(candidate) =>
					Array.isArray(candidate.senseEmojis) &&
					candidate.senseEmojis.length > 0,
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
			lemma: getSpelledLemma(selection) ?? "",
			senses: promptCandidates.map((candidate) => ({
				senseEmojis: candidate.senseEmojis ?? [],
				genus: undefined,
				index: candidate.promptIndex,
				ipa: undefined,
				phrasemeKind:
					candidate.parsedMetaTag.lemmaKind === "Phraseme"
						? LEGACY_PHRASEME_KIND_FROM_NATIVE[
								candidate.parsedMetaTag
									.discriminator as keyof typeof LEGACY_PHRASEME_KIND_FROM_NATIVE
							]
						: undefined,
				pos:
					candidate.parsedMetaTag.lemmaKind === "Lexeme"
						? candidate.parsedMetaTag.discriminator
						: undefined,
				senseGloss: undefined,
				unitKind:
					LEGACY_UNIT_KIND_FROM_NATIVE[
						candidate.parsedMetaTag.lemmaKind
					],
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
			precomputedSenseEmojis:
				promptResult.value.senseEmojis ?? undefined,
		});
	};
}
