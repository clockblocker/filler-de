import type { VaultAction } from "@textfresser/vault-action-manager";
import { ok, type Result } from "neverthrow";
import { SurfaceKind } from "src/packages/independent/old-linguistics/src";
import { resolveDesiredSurfaceKindForPropagationSection } from "../../../common/linguistic-wikilink-context";
import {
	buildPropagationActionPair,
	resolveTargetPath,
} from "../../../common/target-path-resolver";
import { buildSectionMarker } from "../../../domain/dict-note/internal/constants";
import type { TextfresserRelationKind } from "../../../domain/lexical-types";
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

const INVERSE_KIND: Record<TextfresserRelationKind, TextfresserRelationKind> = {
	Antonym: "Antonym",
	Holonym: "Meronym",
	Hypernym: "Hyponym",
	Hyponym: "Hypernym",
	Meronym: "Holonym",
	NearSynonym: "NearSynonym",
	Synonym: "Synonym",
};

const SYMBOL_FOR_KIND: Record<TextfresserRelationKind, string> = {
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
	inverseKind: TextfresserRelationKind,
	sourceWord: string,
): string {
	return `${SYMBOL_FOR_KIND[inverseKind]} [[${sourceWord}]]`;
}

/**
 * Collect all (targetWord, inverseKind) pairs from the relation output.
 */
function collectInversePairs(
	relations: ParsedRelation[],
): { targetWord: string; inverseKind: TextfresserRelationKind }[] {
	const pairs: {
		targetWord: string;
		inverseKind: TextfresserRelationKind;
	}[] = [];
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
		{ inverseKind: TextfresserRelationKind; line: string }[]
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
	const sectionMarker = buildSectionMarker(relationCssSuffix, relationTitle);
	const desiredSurfaceKind =
		resolveDesiredSurfaceKindForPropagationSection(
			DictSectionKind.Relation,
		) ?? SurfaceKind.Lemma;

	for (const [targetWord, entries] of byTarget) {
		const resolved = resolveTargetPath({
			desiredSurfaceKind,
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
