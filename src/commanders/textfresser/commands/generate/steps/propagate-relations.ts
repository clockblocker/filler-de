import { ok, type Result } from "neverthrow";
import type { LinguisticUnitKind } from "../../../../../linguistics/common/enums/core";
import { SurfaceKind } from "../../../../../linguistics/common/enums/core";
import { cssSuffixFor } from "../../../../../linguistics/common/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../../linguistics/common/sections/section-kind";
import type { VaultAction } from "../../../../../managers/obsidian/vault-action-manager";
import {
	SplitPathKind,
	type SplitPathToMdFile,
} from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { VaultActionKind } from "../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import type { RelationSubKind } from "../../../../../prompt-smith/schemas/relation";
import type { TargetLanguage } from "../../../../../types";
import { computeShardedFolderParts } from "../../../common/sharded-path";
import type { CommandError } from "../../types";
import type {
	GenerateSectionsResult,
	ParsedRelation,
} from "./generate-sections";

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

function buildTargetSplitPath(
	word: string,
	targetLanguage: TargetLanguage,
	unitKind: LinguisticUnitKind,
): SplitPathToMdFile {
	return {
		basename: word,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: computeShardedFolderParts(
			word,
			targetLanguage,
			unitKind,
			SurfaceKind.Lemma,
		),
	};
}

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
	const sectionMarker = `<span class="entry_section_title entry_section_title_${relationCssSuffix}">${relationTitle}</span>`;

	for (const [targetWord, entries] of byTarget) {
		const splitPath = buildTargetSplitPath(
			targetWord,
			targetLang,
			unitKind,
		);
		const newLines = entries.map((e) => e.line);

		// ProcessMdFile with transform — reads existing content and appends inverse relation.
		// If the file doesn't exist, VAM will fail gracefully and UpsertMdFile below handles it.
		const processAction: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath,
				transform: (content: string) => {
					// Check if relation section marker exists
					if (content.includes(sectionMarker)) {
						// Append lines to existing section (before next section or end)
						const markerIdx = content.indexOf(sectionMarker);
						const afterMarker = markerIdx + sectionMarker.length;
						const rest = content.slice(afterMarker);

						// Find end of current section (next section marker or end of content)
						const nextSectionMatch = rest.match(
							/<span class="entry_section_title /,
						);
						const insertPoint = nextSectionMatch?.index
							? afterMarker + nextSectionMatch.index
							: content.length;

						// Get existing section content to avoid duplicates
						const existingSection = content.slice(
							afterMarker,
							insertPoint,
						);
						const linesToAdd = newLines.filter(
							(l) => !existingSection.includes(l),
						);
						if (linesToAdd.length === 0) return content;

						return (
							content.slice(0, insertPoint).trimEnd() +
							"\n" +
							linesToAdd.join("\n") +
							content.slice(insertPoint)
						);
					}

					// No relation section — append one at the end
					const linesToAdd = newLines.join("\n");
					return `${content.trimEnd()}\n${sectionMarker}\n${linesToAdd}`;
				},
			},
		};

		// Also create UpsertMdFile as a fallback — ensures the file exists first.
		// UpsertMdFile with content=null just creates the file if it doesn't exist.
		const upsertAction: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: null, splitPath },
		};

		// Upsert first (ensure file exists), then process
		propagationActions.push(upsertAction, processAction);
	}

	return ok({
		...ctx,
		actions: [...ctx.actions, ...propagationActions],
	});
}
