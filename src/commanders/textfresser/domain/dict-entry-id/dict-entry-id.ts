import { z } from "zod/v3";
import {
	type LinguisticUnitKind,
	type POS,
	POS_TAGS,
	type PosTag,
	PosTagSchema,
	posFormFromPosTag,
	posTagFormFromPos,
	type SurfaceKind,
} from "../note-linguistic-policy";
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

interface ParsedLexemeId {
	unitKindTag: "LX";
	unitKind: "Lexeme";
	surfaceKindTag: SurfaceKindTag;
	surfaceKind: SurfaceKind;
	posTag: PosTag;
	pos: POS;
	index: number;
}

interface ParsedNonLexemeId {
	unitKindTag: Exclude<LinguisticUnitKindTag, "LX">;
	unitKind: Exclude<LinguisticUnitKind, "Lexeme">;
	surfaceKindTag: SurfaceKindTag;
	surfaceKind: SurfaceKind;
	posTag: undefined;
	pos: undefined;
	index: number;
}

export type ParsedDictEntryId = ParsedLexemeId | ParsedNonLexemeId;

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
			unitKind: "Lexeme",
			unitKindTag,
		};
	}

	// Phraseme/Morpheme must NOT have a POS tag
	if (rawPos) return undefined;

	return {
		index,
		pos: undefined,
		posTag: undefined,
		surfaceKind: surfaceKindFrom[surfaceKindTag],
		surfaceKindTag,
		unitKind: linguisticUnitKindFrom[unitKindTag],
		unitKindTag,
	} as ParsedNonLexemeId;
}

// -- Build --

interface BuildLexemeIdParts {
	unitKind: "Lexeme";
	surfaceKind: SurfaceKind;
	pos: POS;
	index: number;
}

interface BuildNonLexemeIdParts {
	unitKind: Exclude<LinguisticUnitKind, "Lexeme">;
	surfaceKind: SurfaceKind;
	index: number;
}

export type BuildDictEntryIdParts = BuildLexemeIdParts | BuildNonLexemeIdParts;

export function buildDictEntryId(parts: BuildDictEntryIdParts): string {
	const unitTag = linguisticUnitKindTagFrom[parts.unitKind];
	const surfaceTag = surfaceKindTagFrom[parts.surfaceKind];

	if (parts.unitKind === "Lexeme") {
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

	if (unitKind === "Lexeme" && pos) {
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
