/** biome-ignore-all lint/correctness/noUnusedVariables: README example file */
import { buildToLingConverters } from "../../src";
import type { Lemma, ParsedShallowSurfaceDto, Selection } from "../../src";

// README_BLOCK:ling-id-shallow-see:start
const feminineSee = {
	canonicalLemma: "See",
	inherentFeatures: {
		gender: "Fem",
	},
	language: "German",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🌊",
	pos: "NOUN",
} satisfies Lemma<"German", "Lexeme", "NOUN">;

const seeSurface = {
	language: "German",
	orthographicStatus: "Standard",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "NOUN",
		},
		normalizedFullSurface: "See",
		surfaceKind: "Lemma",
	},
} satisfies ParsedShallowSurfaceDto;

const seeSurfaceWithFullTarget = {
	language: "German",
	orthographicStatus: "Standard",
	spelledSelection: "See",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "NOUN",
		},
		normalizedFullSurface: "See",
		surfaceKind: "Lemma",
		target: feminineSee,
	},
} satisfies Selection<"German", "Standard", "Lemma", "Lexeme", "NOUN">;

const { getShallowSurfaceLingId: toGermanShallowSurfaceLingId } =
	buildToLingConverters("German");

const seeShallowIdsMatch =
	toGermanShallowSurfaceLingId(seeSurface) ===
	toGermanShallowSurfaceLingId(seeSurfaceWithFullTarget);
// README_BLOCK:ling-id-shallow-see:end
