import { z } from "zod/v3";
import type { LinguisticUnitKind, SurfaceKind } from "../enums/core";
import {
	type POS,
	POS_TAGS,
	type PosTag,
	PosTagSchema,
	posFormFromPosTag,
	posTagFormFromPos,
} from "../enums/linguistic-units/lexem/pos";
import {
	LINGUISTIC_UNIT_KIND_TAGS,
	type LinguisticUnitKindTag,
	LinguisticUnitKindTagSchema,
	linguisticUnitKindFrom,
	linguisticUnitKindTagFrom,
	SURFACE_KIND_TAGS,
	type SurfaceKindTag,
	SurfaceKindTagSchema,
	surfaceKindFrom,
	surfaceKindTagFrom,
} from "./tags";

// -- Regex --

const UNIT_TAGS = LINGUISTIC_UNIT_KIND_TAGS.join("|");
const SURFACE_TAGS = SURFACE_KIND_TAGS.join("|");
const POS_TAG_ALTS = POS_TAGS.join("|");

const DICT_ENTRY_ID_REGEX = new RegExp(
	`^(${UNIT_TAGS})-(${SURFACE_TAGS})(?:-(${POS_TAG_ALTS}))?-(\\d+)$`,
);

// -- Schema --

export const DictEntryIdSchema = z.string().regex(DICT_ENTRY_ID_REGEX, {
	message: "Invalid DictEntryId format",
});

export type DictEntryId = z.infer<typeof DictEntryIdSchema>;

// -- Parsed type --

interface ParsedLexemId {
	unitKindTag: "LX";
	unitKind: "Lexem";
	surfaceKindTag: SurfaceKindTag;
	surfaceKind: SurfaceKind;
	posTag: PosTag;
	pos: POS;
	index: number;
}

interface ParsedNonLexemId {
	unitKindTag: Exclude<LinguisticUnitKindTag, "LX">;
	unitKind: Exclude<LinguisticUnitKind, "Lexem">;
	surfaceKindTag: SurfaceKindTag;
	surfaceKind: SurfaceKind;
	posTag: undefined;
	pos: undefined;
	index: number;
}

export type ParsedDictEntryId = ParsedLexemId | ParsedNonLexemId;

// -- Parse --

export function parseDictEntryId(id: string): ParsedDictEntryId | undefined {
	const match = id.match(DICT_ENTRY_ID_REGEX);
	if (!match) return undefined;

	const [, rawUnit, rawSurface, rawPos, rawIndex] = match;

	const unitKindTag = LinguisticUnitKindTagSchema.parse(rawUnit);
	const surfaceKindTag = SurfaceKindTagSchema.parse(rawSurface);
	const index = Number(rawIndex);

	if (unitKindTag === "LX") {
		if (!rawPos) return undefined;
		const posTag = PosTagSchema.parse(rawPos);
		return {
			index,
			pos: posFormFromPosTag[posTag],
			posTag,
			surfaceKind: surfaceKindFrom[surfaceKindTag],
			surfaceKindTag,
			unitKind: "Lexem",
			unitKindTag,
		};
	}

	// Phrasem/Morphem must NOT have a POS tag
	if (rawPos) return undefined;

	return {
		index,
		pos: undefined,
		posTag: undefined,
		surfaceKind: surfaceKindFrom[surfaceKindTag],
		surfaceKindTag,
		unitKind: linguisticUnitKindFrom[unitKindTag],
		unitKindTag,
	} as ParsedNonLexemId;
}

// -- Build --

interface BuildLexemIdParts {
	unitKind: "Lexem";
	surfaceKind: SurfaceKind;
	pos: POS;
	index: number;
}

interface BuildNonLexemIdParts {
	unitKind: Exclude<LinguisticUnitKind, "Lexem">;
	surfaceKind: SurfaceKind;
	index: number;
}

export type BuildDictEntryIdParts = BuildLexemIdParts | BuildNonLexemIdParts;

export function buildDictEntryId(parts: BuildDictEntryIdParts): string {
	const unitTag = linguisticUnitKindTagFrom[parts.unitKind];
	const surfaceTag = surfaceKindTagFrom[parts.surfaceKind];

	if (parts.unitKind === "Lexem") {
		const posTag = posTagFormFromPos[parts.pos];
		return `${unitTag}-${surfaceTag}-${posTag}-${parts.index}`;
	}

	return `${unitTag}-${surfaceTag}-${parts.index}`;
}

// -- Helper facade --

function nextIndex(existingIds: readonly string[], prefix: string): number {
	let max = 0;
	for (const id of existingIds) {
		if (id.startsWith(prefix)) {
			const parsed = parseDictEntryId(id);
			if (parsed && parsed.index > max) {
				max = parsed.index;
			}
		}
	}
	return max + 1;
}

function buildPrefix(
	unitKind: LinguisticUnitKind,
	surfaceKind: SurfaceKind,
	pos?: POS,
): string {
	const unitTag = linguisticUnitKindTagFrom[unitKind];
	const surfaceTag = surfaceKindTagFrom[surfaceKind];

	if (unitKind === "Lexem" && pos) {
		const posTag = posTagFormFromPos[pos];
		return `${unitTag}-${surfaceTag}-${posTag}-`;
	}

	return `${unitTag}-${surfaceTag}-`;
}

export const dictEntryIdHelper = {
	build: buildDictEntryId,
	buildPrefix,
	nextIndex,
	parse: parseDictEntryId,
} as const;
