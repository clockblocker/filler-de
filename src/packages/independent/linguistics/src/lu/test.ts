/** biome-ignore-all lint/correctness/noUnusedVariables: Demo */
import type { Lemma, ResolvedSurface, Selection } from "../index";

type Test = Selection<"English", "Standard", "Inflection", "Lexeme", "ADJ">;
type asdas = ResolvedSurface<
	"English",
	"Standard",
	"Inflection",
	"Lexeme",
	"ADJ"
>;

//
type Test1 = Lemma<"German", "Lexeme", "NOUN">; // Pass auf dich auf
//
//

type Test2 = Lemma<"German", "Lexeme", "VERB">;
type Test3 = Lemma<"German", "Lexeme", "CCONJ">;

// Selection -- могут быть ошибки и можеь быть выделено не все слвооа
// Surface -- без ошибок, вся конструкция, но не в начально форме
// Lemma -- без ошибок, вся конструкция в началотй форме

const simpleWalkSelection = {
	language: "English",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
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
