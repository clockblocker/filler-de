import { ok, type Result } from "neverthrow";
import {
	type LinguisticUnitKind,
	SurfaceKind,
} from "../../../../../linguistics/common/enums/core";
import type { VaultAction } from "../../../../../managers/obsidian/vault-action-manager";
import { wikilinkHelper } from "../../../../../stateless-helpers/wikilink";
import {
	buildPropagationActionPair,
	resolveTargetPath,
} from "../../../common/target-path-resolver";
import { cssSuffixFor } from "../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../targets/de/sections/section-kind";
import type { CommandError } from "../../types";
import type { GenerateSectionsResult } from "./generate-sections";
import { normalizeLemma } from "./morphology-utils";
import {
	appendUniqueLinesToSection,
	appendUniqueLinesToSectionBlock,
	blockHasWikilinkTarget,
} from "./propagation-line-append";

type MorphologyTargetKind = "Equation" | "UsedIn";

type MorphologyTarget = {
	kind: MorphologyTargetKind;
	lines: string[];
	targetWord: string;
	targetUnit: LinguisticUnitKind;
};

function extractFirstNonEmptyLine(raw: string | undefined): string | null {
	if (!raw) return null;

	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.length > 0) return trimmed;
	}
	return null;
}

function buildUsedInLine(
	sourceLemma: string,
	sourceGloss: string | null,
): string {
	if (!sourceGloss) return `[[${sourceLemma}]]`;
	return `[[${sourceLemma}]] *(${sourceGloss})*`;
}

function normalizeWikilinkTarget(target: string): string {
	return target.trim().toLowerCase();
}

function hasEquivalentEquationLine(
	existingBlock: string,
	candidateLine: string,
): boolean {
	const candidateTargets = extractLineTargetSignature(candidateLine);
	if (candidateTargets.length === 0) return false;

	return existingBlock
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.some((existingLine) => {
			const existingTargets = extractLineTargetSignature(existingLine);
			if (existingTargets.length !== candidateTargets.length)
				return false;
			return existingTargets.every((target, index) => {
				const other = candidateTargets[index];
				return other !== undefined && target === other;
			});
		});
}

function extractLineTargetSignature(line: string): string[] {
	return wikilinkHelper
		.parse(line)
		.map((wikilink) => normalizeWikilinkTarget(wikilink.target))
		.filter((target) => target.length > 0);
}

function buildTargets(ctx: GenerateSectionsResult): MorphologyTarget[] {
	const morphology = ctx.morphology;
	if (!morphology) return [];

	const sourceLemma = ctx.textfresserState.latestLemmaResult.lemma;
	const sourceGloss = extractFirstNonEmptyLine(ctx.sourceTranslation);
	const usedInLine = buildUsedInLine(sourceLemma, sourceGloss);
	const targets: MorphologyTarget[] = [];

	const derivedFrom = normalizeLemma(morphology.derivedFromLemma);
	if (
		derivedFrom &&
		normalizeWikilinkTarget(derivedFrom) !==
			normalizeWikilinkTarget(sourceLemma)
	) {
		targets.push({
			kind: "UsedIn",
			lines: [usedInLine],
			targetUnit: ctx.textfresserState.latestLemmaResult.linguisticUnit,
			targetWord: derivedFrom,
		});
	}

	for (const lemma of morphology.compoundedFromLemmas) {
		const normalized = normalizeLemma(lemma);
		if (!normalized) continue;
		if (
			normalizeWikilinkTarget(normalized) ===
			normalizeWikilinkTarget(sourceLemma)
		) {
			continue;
		}
		targets.push({
			kind: "UsedIn",
			lines: [usedInLine],
			targetUnit: ctx.textfresserState.latestLemmaResult.linguisticUnit,
			targetWord: normalized,
		});
	}

	if (morphology.prefixEquation) {
		const targetWord = normalizeLemma(
			morphology.prefixEquation.prefixTarget,
		);
		if (
			targetWord &&
			normalizeWikilinkTarget(targetWord) !==
				normalizeWikilinkTarget(sourceLemma)
		) {
			const sourceGlossSuffix = sourceGloss ? ` *(${sourceGloss})*` : "";
			targets.push({
				kind: "Equation",
				lines: [
					`[[${morphology.prefixEquation.prefixTarget}|${morphology.prefixEquation.prefixDisplay}]] + [[${morphology.prefixEquation.baseLemma}]] = [[${morphology.prefixEquation.sourceLemma}]]${sourceGlossSuffix}`,
				],
				targetUnit: "Morphem",
				targetWord,
			});
		}
	}

	return targets;
}

function groupTargets(
	targets: MorphologyTarget[],
): Map<string, MorphologyTarget> {
	const grouped = new Map<string, MorphologyTarget>();
	for (const target of targets) {
		const key = `${target.kind}::${normalizeWikilinkTarget(target.targetWord)}`;
		const existing = grouped.get(key);
		if (!existing) {
			grouped.set(key, target);
			continue;
		}
		existing.lines.push(...target.lines);
	}
	return grouped;
}

export function propagateMorphologyRelations(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	const targets = buildTargets(ctx);
	if (targets.length === 0) return ok(ctx);

	const groupedTargets = groupTargets(targets);
	const targetLang = ctx.textfresserState.languages.target;
	const sectionCssSuffix = cssSuffixFor[DictSectionKind.Morphology];
	const sectionTitle = TitleReprFor[DictSectionKind.Morphology][targetLang];
	const sectionMarker = `<span class="entry_section_title entry_section_title_${sectionCssSuffix}">${sectionTitle}</span>`;

	const propagationActions: VaultAction[] = [];
	const sourceLemma = ctx.textfresserState.latestLemmaResult.lemma;

	for (const target of groupedTargets.values()) {
		const resolved = resolveTargetPath({
			desiredSurfaceKind: SurfaceKind.Lemma,
			librarianLookup: ctx.textfresserState.lookupInLibrary,
			targetLanguage: targetLang,
			unitKind: target.targetUnit,
			vamLookup: (word) => ctx.textfresserState.vam.findByBasename(word),
			word: target.targetWord,
		});

		const transform =
			target.kind === "UsedIn"
				? (content: string) =>
						appendUniqueLinesToSectionBlock({
							blockMarker: "<used_in>",
							content,
							lines: target.lines,
							sectionMarker,
							shouldSkipLine: ({ currentBlockContent }) =>
								blockHasWikilinkTarget(
									currentBlockContent,
									sourceLemma,
								),
						})
				: (content: string) =>
						appendUniqueLinesToSection({
							content,
							lines: target.lines,
							sectionMarker,
							shouldSkipLine: ({
								candidateLine,
								currentBlockContent,
							}) =>
								blockHasWikilinkTarget(
									currentBlockContent,
									sourceLemma,
								) ||
								hasEquivalentEquationLine(
									currentBlockContent,
									candidateLine,
								),
						});

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
