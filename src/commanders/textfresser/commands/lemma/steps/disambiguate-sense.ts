import { err, ok, type Result } from "neverthrow";
import type {
	CandidateSense,
	ResolvedLemma,
	SenseDisambiguator,
} from "../../../../../lexical-generation";
import type { DeEntity } from "../../../../../linguistics/de";
import {
	readContentErrorToReason,
	type VaultActionManager,
} from "../../../../../managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { AgentOutput } from "../../../../../lexical-generation/internal/prompt-smith";
import { PromptKind } from "../../../../../lexical-generation/internal/prompt-smith/codegen/consts";
import { markdownHelper } from "../../../../../stateless-helpers/markdown-strip";
import { logger } from "../../../../../utils/logger";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import { dictNoteHelper } from "../../../domain/dict-note";
import { commandApiError } from "../../../errors";
import type { PromptRunner } from "../../../llm/prompt-runner";
import { cssSuffixFor } from "../../../targets/de/sections/section-css-kind";
import { DictSectionKind } from "../../../targets/de/sections/section-kind";
import type { CommandError } from "../../types";
import { CommandErrorKind } from "../../types";

type DisambiguationResult =
	| { matchedIndex: number }
	| { matchedIndex: null; precomputedEmojiDescription?: string[] }
	| null;

const TRANSLATION_SECTION_CSS_KIND = cssSuffixFor[DictSectionKind.Translation];

function extractIpaFromHeaderContent(
	headerContent: string,
): string | undefined {
	const match = headerContent.match(
		/\[([^[\]]+)\]\(https?:\/\/youglish\.com\/pronounce\/[^)]+\)/,
	);
	return match?.[1];
}

function extractGenusFromEntity(
	entity: DeEntity | undefined,
): string | undefined {
	if (
		entity?.linguisticUnit === "Lexem" &&
		entity.posLikeKind === "Noun" &&
		"genus" in entity.features.lexical
	) {
		const genus = entity.features.lexical.genus;
		return typeof genus === "string" ? genus : undefined;
	}
	return undefined;
}

function extractPhrasemeKindFromEntity(
	entity: DeEntity | undefined,
):
	| Extract<ResolvedLemma, { linguisticUnit: "Phrasem" }>["posLikeKind"]
	| undefined {
	if (entity?.linguisticUnit === "Phrasem") {
		return entity.posLikeKind;
	}
	return undefined;
}

function extractSenseGlossFromEntity(
	entity: DeEntity | undefined,
): string | undefined {
	const senseGloss = entity?.senseGloss;
	return typeof senseGloss === "string" && senseGloss.length > 0
		? senseGloss
		: undefined;
}

function extractSenseGlossFromTranslationSection(entry: {
	sections: Array<{ content: string; kind: string }>;
}): string | undefined {
	const translationSection = entry.sections.find(
		(section) => section.kind === TRANSLATION_SECTION_CSS_KIND,
	);
	if (!translationSection) {
		return undefined;
	}

	const firstLine = translationSection.content
		.split("\n")
		.map((line) => markdownHelper.stripAll(line).trim())
		.find((line) => line.length > 0);
	if (!firstLine) {
		return undefined;
	}

	return firstLine.slice(0, 120);
}

/**
 * Disambiguate sense for a lemma against existing dictionary entries.
 *
 * Returns:
 * - { matchedIndex } if an existing sense matches
 * - null if this is a new sense or first encounter
 */
export async function disambiguateSense(
	vam: VaultActionManager,
	promptRunner: PromptRunner,
	lemma: ResolvedLemma,
	context: string,
	preferredPath?: SplitPathToMdFile,
	options?: {
		disambiguateWith?: SenseDisambiguator;
	},
): Promise<Result<DisambiguationResult, CommandError>> {
	const readExistingNote = async (
		filePath: SplitPathToMdFile,
	): Promise<Result<string, CommandError>> => {
		const readResult = await vam.readContent(filePath);
		if (readResult.isErr()) {
			return err({
				kind: CommandErrorKind.ApiError,
				reason: readContentErrorToReason(readResult.error),
			});
		}

		return ok(readResult.value);
	};

	const runWithContent = async (
		content: string,
	): Promise<Result<DisambiguationResult, CommandError>> => {
		const existingEntries = dictNoteHelper.parse(content);

		// Match by unitKind + POS, ignoring surfaceKind so that
		// inflected forms (LX-IN-NOUN-*) match lemma entries (LX-LM-NOUN-*)
		const matchingEntries = existingEntries.filter((e) => {
			const parsed = dictEntryIdHelper.parse(e.id);
			if (!parsed) {
				logger.warn(
					`[disambiguate] Failed to parse entry ID: "${e.id}"`,
				);
				return false;
			}
			if (parsed.unitKind !== lemma.linguisticUnit) return false;
			if (
				lemma.linguisticUnit === "Lexem" &&
				parsed.pos !== lemma.posLikeKind
			) {
				return false;
			}
			return true;
		});

		const kindLabel = lemma.posLikeKind;
		logger.info(
			`[disambiguate] Parsed ${existingEntries.length} entries, matching=${matchingEntries.length} (unitKind=${lemma.linguisticUnit}, kind=${kindLabel})`,
		);

		if (matchingEntries.length === 0) {
			logger.info("[disambiguate] No matching entries — new entry");
			return ok(null as DisambiguationResult);
		}

		// Build senses from matching entries
		const senses = matchingEntries
			.map((e) => {
				const parsed = dictEntryIdHelper.parse(e.id);
				if (!parsed) return null;
				const entity = e.meta.entity;
				const emojiDescription =
					Array.isArray(entity?.emojiDescription) &&
					entity.emojiDescription.length > 0
						? entity.emojiDescription
						: null;
				const ipa =
					typeof entity?.ipa === "string" && entity.ipa.length > 0
						? entity.ipa
						: extractIpaFromHeaderContent(e.headerContent);
				const senseGlossFromEntity =
					extractSenseGlossFromEntity(entity);
				const senseGloss =
					senseGlossFromEntity ??
					extractSenseGlossFromTranslationSection(e);
				return {
					emojiDescription,
					genus: extractGenusFromEntity(entity),
					index: parsed.index,
					ipa,
					phrasemeKind: extractPhrasemeKindFromEntity(entity),
					pos: parsed.pos,
					senseGloss,
					unitKind: parsed.unitKind,
				};
			})
			.filter((s) => s !== null);

		logger.info(
			`[disambiguate] Senses: ${JSON.stringify(senses)}, withEmojiDescription: ${senses.filter((s) => s.emojiDescription !== null).length}, withSenseGloss: ${senses.filter((s) => typeof s.senseGloss === "string" && s.senseGloss.length > 0).length}`,
		);

		if (senses.length === 0) {
			// All entries failed to parse — treat as new entry
			logger.info(
				"[disambiguate] All entries failed to parse — new entry",
			);
			return ok(null as DisambiguationResult);
		}

		if (options?.disambiguateWith) {
			const candidateSenses = senses.map((sense): CandidateSense => {
				if (sense.unitKind === "Lexem") {
					return {
						emojiDescription: sense.emojiDescription ?? undefined,
						genus: sense.genus as Extract<
							CandidateSense,
							{ linguisticUnit: "Lexem" }
						>["genus"],
						id: String(sense.index),
						ipa: sense.ipa,
						linguisticUnit: "Lexem",
						posLikeKind: sense.pos as Extract<
							CandidateSense,
							{ linguisticUnit: "Lexem" }
						>["posLikeKind"],
						senseGloss: sense.senseGloss,
					};
				}

				return {
					emojiDescription: sense.emojiDescription ?? undefined,
					id: String(sense.index),
					ipa: sense.ipa,
					linguisticUnit: "Phrasem",
					posLikeKind: (sense.phrasemeKind ??
						lemma.posLikeKind) as Extract<
						CandidateSense,
						{ linguisticUnit: "Phrasem" }
					>["posLikeKind"],
					senseGloss: sense.senseGloss,
				};
			});
			const moduleResult = await options.disambiguateWith(
				lemma,
				context,
				candidateSenses,
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
				return ok({
					matchedIndex: Number(moduleResult.value.senseId),
				});
			}

			return ok({
				matchedIndex: null,
				precomputedEmojiDescription:
					moduleResult.value.precomputedEmojiDescription,
			});
		}

		// Hard cutover: if all matches are missing emojiDescription,
		// we cannot disambiguate reliably, so treat this as a new sense.
		const sensesWithEmoji = senses.filter(
			(s) => s.emojiDescription !== null,
		) as Array<(typeof senses)[number] & { emojiDescription: string[] }>;

		if (sensesWithEmoji.length === 0) {
			logger.info(
				"[disambiguate] Missing emojiDescription on all senses; treating as new sense",
			);
			return ok({
				matchedIndex: null,
			} as DisambiguationResult);
		}

		// Call Disambiguate prompt
		logger.info("[disambiguate] Calling Disambiguate prompt");
		const promptResult = await promptRunner.generate(
			PromptKind.Disambiguate,
			{
				context,
				lemma: lemma.lemma,
				senses: sensesWithEmoji.map((s) => ({
					emojiDescription: s.emojiDescription,
					genus: s.genus,
					index: s.index,
					ipa: s.ipa,
					phrasemeKind: s.phrasemeKind,
					pos: s.pos,
					senseGloss: s.senseGloss,
					unitKind: s.unitKind,
				})),
			},
		);
		if (promptResult.isErr()) {
			return err({
				kind: CommandErrorKind.ApiError,
				reason: promptResult.error.reason,
			});
		}

		const output = promptResult.value as AgentOutput<"Disambiguate">;
		logger.info(
			`[disambiguate] Prompt returned matchedIndex=${output.matchedIndex}`,
		);
		if (output.matchedIndex === null) {
			return ok({
				matchedIndex: null,
				precomputedEmojiDescription:
					output.emojiDescription ?? undefined,
			});
		}

		const validIndices = sensesWithEmoji.map((s) => s.index);
		if (!validIndices.includes(output.matchedIndex)) {
			logger.warn(
				`[disambiguate] matchedIndex ${output.matchedIndex} not in valid indices ${JSON.stringify(validIndices)} — treating as new sense`,
			);
			return ok({
				matchedIndex: null,
				precomputedEmojiDescription:
					output.emojiDescription ?? undefined,
			});
		}

		return ok({ matchedIndex: output.matchedIndex });
	};

	const files = vam.findByBasename(lemma.lemma);
	logger.info(
		`[disambiguate] Found ${files.length} files for "${lemma.lemma}"`,
	);

	if (preferredPath) {
		const preferredContent = await readExistingNote(preferredPath);
		if (preferredContent.isOk()) {
			return runWithContent(preferredContent.value);
		}

		logger.info(
			"[disambiguate] Preferred path could not be read, falling back to basename search",
			{
				lemma: lemma.lemma,
				preferredPath,
			},
		);
		const fallbackPath = files[0];
		if (!fallbackPath) {
			logger.info("[disambiguate] First encounter — no existing note");
			return ok(null as DisambiguationResult);
		}

		const fallbackContent = await readExistingNote(fallbackPath);
		if (fallbackContent.isErr()) {
			return err(fallbackContent.error);
		}
		return runWithContent(fallbackContent.value);
	}

	const filePath = files[0];
	if (!filePath) {
		logger.info("[disambiguate] First encounter — no existing note");
		return ok(null);
	}

	const content = await readExistingNote(filePath);
	if (content.isErr()) {
		return err(content.error);
	}

	return runWithContent(content.value);
}
