import type { ResolvedSurface } from "../../../../src";
import { germanHausLemma } from "./lemmas";

// Attestation: "Das [Haus] steht leer."
export const germanHausResolvedLemmaSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "NOUN",
	},
	language: "German",
	normalizedFullSurface: "Haus",
	surfaceKind: "Lemma",
	target: germanHausLemma,
} satisfies ResolvedSurface<"German", "Standard", "Lemma", "Lexeme", "NOUN">;
