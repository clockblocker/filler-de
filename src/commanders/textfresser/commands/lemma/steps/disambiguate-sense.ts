import { ResultAsync } from "neverthrow";
import { dictEntryIdHelper } from "../../../../../linguistics/common/dict-entry-id/dict-entry-id";
import type { VaultActionManager } from "../../../../../managers/obsidian/vault-action-manager";
import type { AgentOutput } from "../../../../../prompt-smith";
import { PromptKind } from "../../../../../prompt-smith/codegen/consts";
import { dictNoteHelper } from "../../../../../stateless-helpers/dict-note";
import type { PromptRunner } from "../../../prompt-runner";
import type { CommandError } from "../../types";
import { CommandErrorKind } from "../../types";

type LemmaApiResult = {
	lemma: string;
	linguisticUnit: string;
	surfaceKind: string;
	pos?: string | null;
};

type DisambiguationResult = { matchedIndex: number } | null;

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
	if (files.length === 0) {
		// First encounter — no existing note
		return ResultAsync.fromSafePromise(Promise.resolve(null));
	}

	const filePath = files[0]!;

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

		const prefix = dictEntryIdHelper.buildPrefix(
			apiResult.linguisticUnit as "Lexem" | "Phrasem" | "Morphem",
			apiResult.surfaceKind as "Lemma" | "Inflected" | "Variant",
			(apiResult.pos as Parameters<
				typeof dictEntryIdHelper.buildPrefix
			>[2]) ?? undefined,
		);

		const matchingEntries = existingEntries.filter((e) =>
			e.id.startsWith(prefix),
		);

		if (matchingEntries.length === 0) {
			// No entries with this POS prefix — new entry
			return ResultAsync.fromSafePromise(
				Promise.resolve(null as DisambiguationResult),
			);
		}

		// Build senses from matching entries
		const senses = matchingEntries
			.map((e) => {
				const parsed = dictEntryIdHelper.parse(e.id);
				if (!parsed) return null;
				const semantics = e.meta.semantics;
				return {
					index: parsed.index,
					semantics: typeof semantics === "string" ? semantics : null,
				};
			})
			.filter(
				(s): s is { index: number; semantics: string | null } =>
					s !== null,
			);

		if (senses.length === 0) {
			// All entries failed to parse — treat as new entry
			return ResultAsync.fromSafePromise(
				Promise.resolve(null as DisambiguationResult),
			);
		}

		// Edge case: all matching entries lack semantics (V2 legacy)
		// → backward compat: treat as re-encounter of the first match
		const sensesWithSemantics = senses.filter(
			(s): s is { index: number; semantics: string } =>
				s.semantics !== null,
		);

		if (sensesWithSemantics.length === 0) {
			return ResultAsync.fromSafePromise(
				Promise.resolve({
					matchedIndex: senses[0]?.index,
				} as DisambiguationResult),
			);
		}

		// Call Disambiguate prompt
		return ResultAsync.fromPromise(
			promptRunner.generate(PromptKind.Disambiguate, {
				context,
				lemma: apiResult.lemma,
				senses: sensesWithSemantics,
			}),
			(e): CommandError => ({
				kind: CommandErrorKind.ApiError,
				reason: e instanceof Error ? e.message : String(e),
			}),
		).map((output: AgentOutput<"Disambiguate">): DisambiguationResult => {
			if (output.matchedIndex === null) return null;
			return { matchedIndex: output.matchedIndex };
		});
	});
}
