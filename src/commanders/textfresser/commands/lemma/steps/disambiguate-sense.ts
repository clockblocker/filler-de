import { ResultAsync } from "neverthrow";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import type { PhrasemeKind } from "../../../../../linguistics/common/enums/linguistic-units/phrasem/phrasem-kind";
import type { DeLexemPos } from "../../../../../linguistics/de/lemma";
import type { VaultActionManager } from "../../../../../managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { AgentOutput } from "../../../../../prompt-smith";
import { PromptKind } from "../../../../../prompt-smith/codegen/consts";
import { dictNoteHelper } from "../../../domain/dict-note";
import { logger } from "../../../../../utils/logger";
import type { PromptRunner } from "../../../llm/prompt-runner";
import type { CommandError } from "../../types";
import { CommandErrorKind } from "../../types";

type LemmaApiResult =
	| {
			lemma: string;
			linguisticUnit: "Lexem";
			phrasemeKind?: undefined;
			pos: DeLexemPos;
			surfaceKind: string;
	  }
	| {
			lemma: string;
			linguisticUnit: "Phrasem";
			phrasemeKind: PhrasemeKind;
			pos?: undefined;
			surfaceKind: string;
	  };

type DisambiguationResult =
	| { matchedIndex: number }
	| { matchedIndex: null; precomputedEmojiDescription?: string[] }
	| null;

/**
 * Disambiguate sense for a lemma against existing dictionary entries.
 *
 * Returns:
 * - { matchedIndex } if an existing sense matches
 * - null if this is a new sense or first encounter
 */
export function disambiguateSense(
	vam: VaultActionManager,
	promptRunner: PromptRunner,
	apiResult: LemmaApiResult,
	context: string,
	preferredPath?: SplitPathToMdFile,
): ResultAsync<DisambiguationResult, CommandError> {
	const readExistingNote = (
		filePath: SplitPathToMdFile,
	): ResultAsync<string, CommandError> =>
		ResultAsync.fromPromise(
			vam.readContent(filePath).then((r) => {
				if (r.isErr()) throw new Error(r.error);
				return r.value;
			}),
			(e): CommandError => ({
				kind: CommandErrorKind.ApiError,
				reason: e instanceof Error ? e.message : String(e),
			}),
		);

	const runWithContent = (content: string): ResultAsync<DisambiguationResult, CommandError> => {
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
			if (parsed.unitKind !== apiResult.linguisticUnit) return false;
			if (
				apiResult.linguisticUnit === "Lexem" &&
				parsed.pos !== apiResult.pos
			) {
				return false;
			}
			return true;
		});

		const kindLabel =
			apiResult.linguisticUnit === "Lexem"
				? apiResult.pos
				: apiResult.phrasemeKind;
		logger.info(
			`[disambiguate] Parsed ${existingEntries.length} entries, matching=${matchingEntries.length} (unitKind=${apiResult.linguisticUnit}, kind=${kindLabel})`,
		);

		if (matchingEntries.length === 0) {
			logger.info("[disambiguate] No matching entries — new entry");
			return ResultAsync.fromSafePromise(
				Promise.resolve(null as DisambiguationResult),
			);
		}

		// Build senses from matching entries
		const senses = matchingEntries
			.map((e) => {
				const parsed = dictEntryIdHelper.parse(e.id);
				if (!parsed) return null;
				const emojiDescription = e.meta.emojiDescription;
				// Extract genus from linguisticUnit if available
				const lu = e.meta.linguisticUnit;
				let genus: string | undefined;
				let phrasemeKind: PhrasemeKind | undefined;
				if (lu?.kind === "Lexem") {
					const features = lu.surface.features;
					if (features.pos === "Noun" && "genus" in features) {
						genus = features.genus;
					}
				} else if (lu?.kind === "Phrasem") {
					phrasemeKind = lu.surface.features.phrasemeKind;
				}
				return {
					emojiDescription: Array.isArray(emojiDescription)
						? emojiDescription
						: null,
					genus,
					index: parsed.index,
					phrasemeKind,
					pos: parsed.pos,
					unitKind: parsed.unitKind,
				};
			})
			.filter((s) => s !== null);

		logger.info(
			`[disambiguate] Senses: ${JSON.stringify(senses)}, withEmojiDescription: ${senses.filter((s) => s.emojiDescription !== null).length}`,
		);

		if (senses.length === 0) {
			// All entries failed to parse — treat as new entry
			logger.info(
				"[disambiguate] All entries failed to parse — new entry",
			);
			return ResultAsync.fromSafePromise(
				Promise.resolve(null as DisambiguationResult),
			);
		}

		// Edge case: all matching entries lack emojiDescription (V2 legacy)
		// → backward compat: treat as re-encounter of the first match
		const sensesWithEmoji = senses.filter(
			(s) => s.emojiDescription !== null,
		) as Array<(typeof senses)[number] & { emojiDescription: string[] }>;

		if (sensesWithEmoji.length === 0) {
			logger.info(
				"[disambiguate] V2 legacy path — no emojiDescription on any sense",
			);
			return ResultAsync.fromSafePromise(
				Promise.resolve({
					matchedIndex: senses[0]?.index,
				} as DisambiguationResult),
			);
		}

		// Call Disambiguate prompt
		logger.info("[disambiguate] Calling Disambiguate prompt");
		return promptRunner
			.generate(PromptKind.Disambiguate, {
				context,
				lemma: apiResult.lemma,
				senses: sensesWithEmoji.map((s) => ({
					emojiDescription: s.emojiDescription,
					genus: s.genus,
					index: s.index,
					phrasemeKind: s.phrasemeKind,
					pos: s.pos,
					unitKind: s.unitKind,
				})),
			})
			.mapErr(
				(e): CommandError => ({
					kind: CommandErrorKind.ApiError,
					reason: e.reason,
				}),
			)
			.map(
				(output: AgentOutput<"Disambiguate">): DisambiguationResult => {
					logger.info(
						`[disambiguate] Prompt returned matchedIndex=${output.matchedIndex}`,
					);
					if (output.matchedIndex === null) {
						return {
							matchedIndex: null,
							precomputedEmojiDescription:
								output.emojiDescription ?? undefined,
						};
					}

					const validIndices = sensesWithEmoji.map((s) => s.index);
					if (!validIndices.includes(output.matchedIndex)) {
						logger.warn(
							`[disambiguate] matchedIndex ${output.matchedIndex} not in valid indices ${JSON.stringify(validIndices)} — treating as new sense`,
						);
						return {
							matchedIndex: null,
							precomputedEmojiDescription:
								output.emojiDescription ?? undefined,
						};
					}

					return { matchedIndex: output.matchedIndex };
				},
			);
	};

	const files = vam.findByBasename(apiResult.lemma);
	logger.info(
		`[disambiguate] Found ${files.length} files for "${apiResult.lemma}"`,
	);

	if (preferredPath) {
		return readExistingNote(preferredPath)
			.andThen(runWithContent)
			.orElse(() => {
				logger.warn(
					"[disambiguate] Preferred path could not be read, falling back to basename search",
					{
						lemma: apiResult.lemma,
						preferredPath,
					},
				);
				const fallbackPath = files[0];
				if (!fallbackPath) {
					logger.info(
						"[disambiguate] First encounter — no existing note",
					);
					return ResultAsync.fromSafePromise(
						Promise.resolve(null as DisambiguationResult),
					);
				}
				return readExistingNote(fallbackPath).andThen(runWithContent);
			});
	}

	const filePath = files[0];
	if (!filePath) {
		logger.info("[disambiguate] First encounter — no existing note");
		return ResultAsync.fromSafePromise(Promise.resolve(null));
	}

	return readExistingNote(filePath).andThen(runWithContent);
}
