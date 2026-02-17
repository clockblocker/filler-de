import { wikilinkHelper } from "../../../../../../stateless-helpers/wikilink";
import type { EntrySection } from "../../../../domain/dict-note/types";
import {
	type MorphemeItem,
	morphemeFormatterHelper,
} from "../../../../domain/morpheme/morpheme-formatter";
import { cssSuffixFor } from "../../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../targets/de/sections/section-kind";
import { normalizeLemma } from "../morphology-utils";
import type {
	GenerationTargetLanguage,
	MorphemOutput,
	MorphologyPayload,
} from "../section-generation-types";

export type MorphologySectionContext = {
	morphemes: MorphemeItem[];
	output: MorphemOutput;
	sourceLemma: string;
	sourceTranslation?: string;
	targetLang: GenerationTargetLanguage;
};

export type MorphologySectionResult = {
	morphology?: MorphologyPayload;
	section: EntrySection | null;
};

function dedupeLemmas(lemmas: string[]): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const lemma of lemmas) {
		const normalized = lemma.trim();
		if (normalized.length === 0) continue;
		const key = normalized.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(normalized);
	}
	return out;
}

function buildGlossSuffix(sourceTranslation?: string): string {
	const firstLine = sourceTranslation
		?.split("\n")
		.map((line) => line.trim())
		.find((line) => line.length > 0);
	return firstLine ? ` *(${firstLine})*` : "";
}

function inferPrefixEquation(
	morphemes: MorphemeItem[],
	sourceLemma: string,
	targetLang: GenerationTargetLanguage,
): MorphologyPayload["prefixEquation"] {
	const first = morphemes[0];
	if (!first || first.kind !== "Prefix") return undefined;

	const base = morphemes
		.slice(1)
		.find((item) => item.kind === "Root" || item.kind === "Suffixoid");
	const baseLemma = normalizeLemma(base?.lemma ?? base?.surf);
	if (!baseLemma) return undefined;

	const prefixTarget = normalizeLemma(
		first.linkTarget ?? first.lemma ?? first.surf,
	);
	if (!prefixTarget) return undefined;

	return {
		baseLemma,
		prefixDisplay: morphemeFormatterHelper.decorateSurface(
			first.surf,
			first.separability,
			targetLang,
		),
		prefixTarget,
		sourceLemma,
	};
}

function buildPrefixEquationLine(
	equation: NonNullable<MorphologyPayload["prefixEquation"]>,
	sourceTranslation?: string,
): string {
	const gloss = buildGlossSuffix(sourceTranslation);
	return `[[${equation.prefixTarget}|${equation.prefixDisplay}]] + [[${equation.baseLemma}]] = [[${equation.sourceLemma}]]${gloss}`;
}

function haveSameWikilinkTargets(left: string, right: string): boolean {
	const leftTargets = wikilinkHelper
		.parse(left)
		.map((wikilink) => wikilink.target.trim().toLowerCase());
	const rightTargets = wikilinkHelper
		.parse(right)
		.map((wikilink) => wikilink.target.trim().toLowerCase());
	if (leftTargets.length !== rightTargets.length) return false;

	return leftTargets.every((target, index) => {
		const rightTarget = rightTargets[index];
		return rightTarget !== undefined && rightTarget === target;
	});
}

export function generateMorphologySection(
	ctx: MorphologySectionContext,
): MorphologySectionResult {
	const sourceLemma = normalizeLemma(ctx.sourceLemma);
	if (!sourceLemma) {
		return { section: null };
	}

	const inferredPrefixEquation = inferPrefixEquation(
		ctx.morphemes,
		sourceLemma,
		ctx.targetLang,
	);
	const derivedFromLemma = normalizeLemma(
		inferredPrefixEquation?.baseLemma ?? ctx.output.derived_from?.lemma,
	);
	const compoundedFromLemmas = dedupeLemmas(ctx.output.compounded_from ?? []);

	const lines: string[] = [];
	if (derivedFromLemma && !inferredPrefixEquation) {
		lines.push("<derived_from>", `[[${derivedFromLemma}]]`);
	}

	if (compoundedFromLemmas.length > 0) {
		lines.push(
			"<consists_of>",
			compoundedFromLemmas.map((lemma) => `[[${lemma}]]`).join(" + "),
		);
	}

	if (inferredPrefixEquation) {
		const equationLine = buildPrefixEquationLine(
			inferredPrefixEquation,
			ctx.sourceTranslation,
		);
		const hasEquivalentLine = lines.some((line) =>
			haveSameWikilinkTargets(line, equationLine),
		);
		if (!hasEquivalentLine) {
			lines.push(equationLine);
		}
	}

	if (lines.length === 0) {
		return { section: null };
	}

	return {
		morphology: {
			compoundedFromLemmas,
			...(derivedFromLemma ? { derivedFromLemma } : {}),
			...(inferredPrefixEquation
				? { prefixEquation: inferredPrefixEquation }
				: {}),
		},
		section: {
			content: lines.join("\n"),
			kind: cssSuffixFor[DictSectionKind.Morphology],
			title: TitleReprFor[DictSectionKind.Morphology][ctx.targetLang],
		},
	};
}
