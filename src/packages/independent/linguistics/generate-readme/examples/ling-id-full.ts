/** biome-ignore-all lint/correctness/noUnusedVariables: README example file */

import type { Lemma, Selection } from "../../src";
import { buildToLingConverters } from "../../src";

// README_BLOCK:ling-id-full-walk:start
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

const { getSurfaceLingId: toEnglishSurfaceLingId } =
	buildToLingConverters("English");

const walkSurfaceId = toEnglishSurfaceLingId(walkSurfaceSelection);
// README_BLOCK:ling-id-full-walk:end

// README_BLOCK:ling-id-full-canonical-target:start
const walkSurfaceWithCanonicalTargetSelection = {
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
		target: {
			canonicalLemma: "walk",
		},
	},
} satisfies Selection<"English", "Standard", "Inflection", "Lexeme", "VERB">;

const walkSurfaceWithCanonicalTargetId = toEnglishSurfaceLingId(
	walkSurfaceWithCanonicalTargetSelection,
);
// README_BLOCK:ling-id-full-canonical-target:end
