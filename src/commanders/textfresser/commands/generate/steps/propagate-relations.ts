import { ok, type Result } from "neverthrow";
import { SurfaceKind } from "../../../../../linguistics/common/enums/core";
import type { VaultAction } from "../../../../../managers/obsidian/vault-action-manager";
import type { RelationSubKind } from "../../../../../prompt-smith/schemas/relation";
import {
	buildPropagationActionPair,
	resolveTargetPath,
} from "../../../common/target-path-resolver";
import { buildSectionMarkerHtml } from "../../../domain/dict-note/internal/constants";
import { cssSuffixFor } from "../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../targets/de/sections/section-kind";
import type { CommandError } from "../../types";
import type {
	GenerateSectionsResult,
	ParsedRelation,
} from "./generate-sections";
import {
	appendUniqueLinesToSection,
	blockHasWikilinkTarget,
} from "./propagation-line-append";

const INVERSE_KIND: Record<RelationSubKind, RelationSubKind> = {
	Antonym: "Antonym",
	Holonym: "Meronym",
	Hypernym: "Hyponym",
	Hyponym: "Hypernym",
	Meronym: "Holonym",
	NearSynonym: "NearSynonym",
	Synonym: "Synonym",
};

const SYMBOL_FOR_KIND: Record<RelationSubKind, string> = {
	Antonym: "≠",
	Holonym: "∋",
	Hypernym: "⊃",
	Hyponym: "⊂",
	Meronym: "∈",
	NearSynonym: "≈",
	Synonym: "=",
};

/**
 * Build a formatted inverse relation line: `{symbol} [[source]]`
 */
function buildInverseRelationLine(
	inverseKind: RelationSubKind,
	sourceWord: string,
): string {
	return `${SYMBOL_FOR_KIND[inverseKind]} [[${sourceWord}]]`;
}

/**
 * Collect all (targetWord, inverseKind) pairs from the relation output.
 */
function collectInversePairs(
	relations: ParsedRelation[],
): { targetWord: string; inverseKind: RelationSubKind }[] {
	const pairs: { targetWord: string; inverseKind: RelationSubKind }[] = [];
	for (const rel of relations) {
		const inverseKind = INVERSE_KIND[rel.kind];
		for (const word of rel.words) {
			pairs.push({ inverseKind, targetWord: word });
		}
	}
	return pairs;
}

/**
 * For each related word, generate a ProcessMdFile action that appends the inverse relation.
 * Uses a transform function so the VAM can read-then-write atomically.
 *
 * If the target note doesn't exist, creates it with UpsertMdFile containing a minimal stub
 * with just the inverse relation line.
 */
export function propagateRelations(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	const { relations } = ctx;
	if (relations.length === 0) {
		return ok(ctx);
	}

	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const sourceWord = lemmaResult.lemma;
	const targetLang = ctx.textfresserState.languages.target;
	const unitKind = lemmaResult.linguisticUnit;
	const pairs = collectInversePairs(relations);

	// Group pairs by target word (a word may appear in multiple relation kinds)
	const byTarget = new Map<
		string,
		{ inverseKind: RelationSubKind; line: string }[]
	>();
	for (const { targetWord, inverseKind } of pairs) {
		if (targetWord === sourceWord) continue; // skip self-references
		const lines = byTarget.get(targetWord) ?? [];
		lines.push({
			inverseKind,
			line: buildInverseRelationLine(inverseKind, sourceWord),
		});
		byTarget.set(targetWord, lines);
	}

	const propagationActions: VaultAction[] = [];
	const relationCssSuffix = cssSuffixFor[DictSectionKind.Relation];
	const relationTitle = TitleReprFor[DictSectionKind.Relation][targetLang];
	const sectionMarker = buildSectionMarkerHtml(relationCssSuffix, relationTitle);

	for (const [targetWord, entries] of byTarget) {
		const resolved = resolveTargetPath({
			desiredSurfaceKind: SurfaceKind.Lemma,
			librarianLookup: ctx.textfresserState.lookupInLibrary,
			targetLanguage: targetLang,
			unitKind,
			vamLookup: (w) => ctx.textfresserState.vam.findByBasename(w),
			word: targetWord,
		});
		const newLines = entries.map((e) => e.line);

		const transform = (content: string) => {
			return appendUniqueLinesToSection({
				content,
				lines: newLines,
				sectionMarker,
				shouldSkipLine: ({ currentBlockContent }) =>
					blockHasWikilinkTarget(currentBlockContent, sourceWord),
			});
		};

		propagationActions.push(...resolved.healingActions);
		propagationActions.push(
			...buildPropagationActionPair(resolved.splitPath, transform),
		);
	}

	return ok({
		...ctx,
		actions: [...ctx.actions, ...propagationActions],
	});
}
