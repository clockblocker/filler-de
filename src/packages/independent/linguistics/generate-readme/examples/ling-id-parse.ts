/** biome-ignore-all lint/correctness/noUnusedVariables: README example file */
import { buildToLingConverters } from "../../src";
import type { Lemma, Selection } from "../../src";

// README_BLOCK:ling-id-parse:start
const walkLemma = {
	canonicalLemma: "walk",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;

const walkSurfaceSelection = {
	language: "English",
	orthographicStatus: "Standard",
	spelledSelection: "walk",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		inflectionalFeatures: {
			tense: "Pres",
			verbForm: "Fin",
		},
		normalizedFullSurface: "walk",
		surfaceKind: "Inflection",
		target: walkLemma,
	},
} satisfies Selection<"English", "Standard", "Inflection", "Lexeme", "VERB">;

const { getSurfaceLingId, parseSurface } = buildToLingConverters("English");

const walkSurfaceId = getSurfaceLingId(walkSurfaceSelection);
const walkLemmaId = getSurfaceLingId(walkLemma);

const parsedWalkSurface = parseSurface(walkSurfaceId);

if ("surface" in parsedWalkSurface) {
	getSurfaceLingId(parsedWalkSurface) === walkSurfaceId;
}

const parsedWalkLemmaIdentity = parseSurface(walkLemmaId);

if (!("surface" in parsedWalkLemmaIdentity)) {
	getSurfaceLingId(parsedWalkLemmaIdentity) === walkLemmaId;
}
// README_BLOCK:ling-id-parse:end
