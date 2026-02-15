import { ResultAsync } from "neverthrow";
import { dictEntryIdHelper } from "../../../../../linguistics/common/dict-entry-id/dict-entry-id";
import type { PhrasemeKind } from "../../../../../linguistics/common/enums/linguistic-units/phrasem/phrasem-kind";
import type { VaultActionManager } from "../../../../../managers/obsidian/vault-action-manager";
import type { AgentOutput } from "../../../../../prompt-smith";
import { PromptKind } from "../../../../../prompt-smith/codegen/consts";
import { dictNoteHelper } from "../../../../../stateless-helpers/dict-note";
import { logger } from "../../../../../utils/logger";
import type { PromptRunner } from "../../../prompt-runner";
import type { CommandError } from "../../types";
import { CommandErrorKind } from "../../types";

type LemmaApiResult = {
	lemma: string;
	linguisticUnit: string;
	phrasemeKind?: PhrasemeKind | null;
	surfaceKind: string;
	pos?: string | null;
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
): ResultAsync<DisambiguationResult, CommandError> {
	const files = vam.findByBasename(apiResult.lemma);
	logger.info(
		`[disambiguate] Found ${files.length} files for "${apiResult.lemma}"`,
	);

	const filePath = files[0];
	if (!filePath) {
		logger.info("[disambiguate] First encounter — no existing note");
		return ResultAsync.fromSafePromise(Promise.resolve(null));
	}

	return ResultAsync.fromPromise(
		vam.readContent(filePath).then((r) => {
			if (r.isErr()) throw new Error(r.error);
			return r.value;
		}),
		(e): CommandError => ({
			kind: CommandErrorKind.ApiError,
			reason: e instanceof Error ? e.message : String(e),
		}),
	).andThen((content) => {
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
			if (apiResult.pos && parsed.pos !== apiResult.pos) return false;
			return true;
		});

		logger.info(
			`[disambiguate] Parsed ${existingEntries.length} entries, matching=${matchingEntries.length} (unitKind=${apiResult.linguisticUnit}, pos=${apiResult.pos ?? "none"})`,
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
	});
}
