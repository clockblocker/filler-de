import type { Result } from "neverthrow";
import { LANGUAGE_ISO_CODE } from "../../../../../linguistics/common/enums/core";
import { decorateAttestationSeparability } from "./decorate-attestation-separability";
import type { CommandError } from "../../types";
import type { GenerateSectionsResult } from "./generate-sections";
import { propagateInflections } from "./propagate-inflections";
import { propagateMorphemes } from "./propagate-morphemes";
import { propagateMorphologyRelations } from "./propagate-morphology-relations";
import { propagateRelations } from "./propagate-relations";
import { propagateV2 } from "./propagate-v2";

const V2_MIGRATED_LEXEM_POS = [
	"adjective",
	"adverb",
	"article",
	"conjunction",
	"interactionalunit",
	"noun",
	"particle",
	"preposition",
	"pronoun",
	"verb",
] as const;

const V2_MIGRATED_PHRASEM_KINDS = [
	"collocation",
	"culturalquotation",
	"discourseformula",
	"idiom",
	"proverb",
] as const;

const V2_MIGRATED_SLICE_KEYS = new Set<string>([
	...V2_MIGRATED_LEXEM_POS.map((pos) => `de/lexem/${pos}`),
	...V2_MIGRATED_PHRASEM_KINDS.map((kind) => `de/phrasem/${kind}`),
]);

function normalizeSliceSegment(value: string): string {
	return value.trim().toLowerCase();
}

export function buildPropagationSliceKey(
	ctx: GenerateSectionsResult,
): string {
	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const lang = LANGUAGE_ISO_CODE[ctx.textfresserState.languages.target];
	const unit = normalizeSliceSegment(lemmaResult.linguisticUnit);
	const pos = normalizeSliceSegment(lemmaResult.posLikeKind);
	return `${lang}/${unit}/${pos}`;
}

export function propagateLegacyV1(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	return propagateRelations(ctx)
		.andThen(propagateMorphologyRelations)
		.andThen(propagateMorphemes)
		.andThen(propagateInflections);
}

function shouldRouteToV2(ctx: GenerateSectionsResult): boolean {
	if (!ctx.textfresserState.propagationV2Enabled) {
		return false;
	}
	return V2_MIGRATED_SLICE_KEYS.has(buildPropagationSliceKey(ctx));
}

export function propagateGeneratedSections(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	if (shouldRouteToV2(ctx)) {
		return propagateV2(ctx).andThen(decorateAttestationSeparability);
	}

	return propagateLegacyV1(ctx).andThen(decorateAttestationSeparability);
}
