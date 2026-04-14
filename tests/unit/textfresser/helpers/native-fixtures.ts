import { SelectionSchema } from "@textfresser/linguistics";
import {
	createLexicalMeta,
	type LexemeInflections,
	type LexicalInfo,
	type LexicalMeta,
	type LexicalRelations,
	type MorphemicBreakdown,
	type ResolvedSelection,
} from "@textfresser/lexical-generation";
import type {
	LemmaResult,
	LexemeLemmaResult,
	PhrasemeLemmaResult,
} from "../../../../src/commanders/textfresser/commands/lemma/types";
import type { Attestation } from "../../../../src/commanders/textfresser/common/attestation/types";

type LexemePos = keyof (typeof SelectionSchema.German.Standard.Lemma.Lexeme);
type PhrasemeKind = keyof typeof SelectionSchema.German.Standard.Lemma.Phraseme;
type SurfaceKind = keyof typeof SelectionSchema.German.Standard;
type LexemeSelection = Extract<
	Exclude<ResolvedSelection, { orthographicStatus: "Unknown" }>,
	{ surface: { discriminators: { lemmaKind: "Lexeme" } } }
>;
type PhrasemeSelection = Extract<
	Exclude<ResolvedSelection, { orthographicStatus: "Unknown" }>,
	{ surface: { discriminators: { lemmaKind: "Phraseme" } } }
>;

export function makeAttestation(params: {
	ref?: string;
	sourcePath?: Attestation["source"]["path"];
	surface?: string;
	textRaw?: string;
	textWithOnlyTargetMarked?: string;
} = {}): Attestation {
	return {
		source: {
			path: params.sourcePath ?? {
				basename: "Source",
				extension: "md",
				kind: "MdFile",
				pathParts: ["Books"],
			},
			ref: params.ref ?? "![[Source#^1|^]]",
			textRaw: params.textRaw ?? "Das ist ein Test. ^1",
			textWithOnlyTargetMarked:
				params.textWithOnlyTargetMarked ?? "Das ist ein [Test]. ^1",
		},
		target: {
			offsetInBlock: 0,
			surface: params.surface ?? "Test",
		},
	};
}

export function makeLexemeSelection(params: {
	contextWithLinkedParts?: string;
	lemma?: string;
	pos?: LexemePos;
	spelledSurface?: string;
	surfaceKind?: Exclude<SurfaceKind, "Unknown">;
} = {}): LexemeSelection {
	const lemma = params.lemma ?? "Test";
	const pos = params.pos ?? "NOUN";
	const surfaceKind = params.surfaceKind ?? "Lemma";
	const spelledSurface = params.spelledSurface ?? lemma;
	const rawSelection = {
		contextWithLinkedParts: params.contextWithLinkedParts,
		language: "German" as const,
		orthographicStatus: "Standard" as const,
		surface: {
			...(surfaceKind === "Inflection" ? { inflectionalFeatures: {} } : {}),
			discriminators: {
				lemmaKind: "Lexeme" as const,
				lemmaSubKind: pos,
			},
			spelledSurface,
			surfaceKind,
			target: {
				spelledLemma: lemma,
			},
		},
	};

	return SelectionSchema.German.Standard[surfaceKind].Lexeme[pos].parse(
		rawSelection,
	) as LexemeSelection;
}

export function makePhrasemeSelection(params: {
	contextWithLinkedParts?: string;
	lemma?: string;
	phrasemeKind?: PhrasemeKind;
	spelledSurface?: string;
} = {}): PhrasemeSelection {
	const lemma = params.lemma ?? "auf jeden Fall";
	const phrasemeKind = params.phrasemeKind ?? "DiscourseFormula";
	const spelledSurface = params.spelledSurface ?? lemma;
	const rawSelection = {
		contextWithLinkedParts: params.contextWithLinkedParts,
		language: "German" as const,
		orthographicStatus: "Standard" as const,
		surface: {
			discriminators: {
				lemmaKind: "Phraseme" as const,
				lemmaSubKind: phrasemeKind,
			},
			spelledSurface,
			surfaceKind: "Lemma" as const,
			target: {
				spelledLemma: lemma,
			},
		},
	};

	return SelectionSchema.German.Standard.Lemma.Phraseme[phrasemeKind].parse(
		rawSelection,
	) as PhrasemeSelection;
}

export function makeLexemeLemmaResult(params: {
	attestation?: Attestation;
	contextWithLinkedParts?: string;
	disambiguationResult?: { matchedIndex: number } | null;
	lemma?: string;
	pos?: LexemePos;
	precomputedSenseEmojis?: string[];
	spelledSurface?: string;
	surfaceKind?: Exclude<SurfaceKind, "Unknown">;
} = {}): LexemeLemmaResult {
	const selection = makeLexemeSelection(params);
	const lemma = params.lemma ?? "Test";
	const pos = params.pos ?? "NOUN";
	const surfaceKind = params.surfaceKind ?? "Lemma";

	return {
		...selection,
		attestation: params.attestation ?? makeAttestation({ surface: lemma }),
		disambiguationResult: params.disambiguationResult ?? null,
		lemma,
		linguisticUnit: "Lexeme",
		posLikeKind: pos,
		...(params.precomputedSenseEmojis
			? { precomputedSenseEmojis: params.precomputedSenseEmojis }
			: {}),
		surfaceKind,
	};
}

export function makePhrasemeLemmaResult(params: {
	attestation?: Attestation;
	contextWithLinkedParts?: string;
	disambiguationResult?: { matchedIndex: number } | null;
	lemma?: string;
	phrasemeKind?: PhrasemeKind;
	precomputedSenseEmojis?: string[];
	spelledSurface?: string;
} = {}): PhrasemeLemmaResult {
	const selection = makePhrasemeSelection(params);
	const lemma = params.lemma ?? "auf jeden Fall";

	return {
		...selection,
		attestation: params.attestation ?? makeAttestation({ surface: lemma }),
		disambiguationResult: params.disambiguationResult ?? null,
		lemma,
		linguisticUnit: "Phraseme",
		posLikeKind: null,
		...(params.precomputedSenseEmojis
			? { precomputedSenseEmojis: params.precomputedSenseEmojis }
			: {}),
		surfaceKind: "Lemma",
	};
}

export function makeLexemeLexicalInfo(params: {
	core?: LexicalInfo["core"];
	features?: LexicalInfo["features"];
	inflections?: LexicalInfo["inflections"];
	lemma?: string;
	morphemicBreakdown?: LexicalInfo["morphemicBreakdown"];
	pos?: LexemePos;
	relations?: LexicalInfo["relations"];
	selection?: LexemeSelection;
	spelledSurface?: string;
	surfaceKind?: Exclude<SurfaceKind, "Unknown">;
} = {}): LexicalInfo {
	const lemma = params.lemma ?? "Test";
	return {
		core: params.core ?? {
			status: "ready",
			value: {
				senseEmojis: ["🔧"],
				ipa: "tɛst",
			},
		},
		features: params.features ?? {
			status: "ready",
			value: {
				inherentFeatures: {},
			},
		},
		inflections: params.inflections ?? { status: "not_applicable" },
		morphemicBreakdown:
			params.morphemicBreakdown ?? { status: "not_applicable" },
		relations: params.relations ?? { status: "not_applicable" },
		selection:
			params.selection ??
			makeLexemeSelection({
				lemma,
				pos: params.pos,
				spelledSurface: params.spelledSurface,
				surfaceKind: params.surfaceKind,
			}),
	};
}

export function makePhrasemeLexicalInfo(params: {
	core?: LexicalInfo["core"];
	features?: LexicalInfo["features"];
	inflections?: LexicalInfo["inflections"];
	lemma?: string;
	morphemicBreakdown?: LexicalInfo["morphemicBreakdown"];
	phrasemeKind?: PhrasemeKind;
	relations?: LexicalInfo["relations"];
	selection?: PhrasemeSelection;
	spelledSurface?: string;
} = {}): LexicalInfo {
	const lemma = params.lemma ?? "auf jeden Fall";
	return {
		core: params.core ?? {
			status: "ready",
			value: {
				senseEmojis: ["💬"],
				ipa: "tɛst",
			},
		},
		features: params.features ?? { status: "not_applicable" },
		inflections: params.inflections ?? { status: "not_applicable" },
		morphemicBreakdown:
			params.morphemicBreakdown ?? { status: "not_applicable" },
		relations: params.relations ?? { status: "not_applicable" },
		selection:
			params.selection ??
			makePhrasemeSelection({
				lemma,
				phrasemeKind: params.phrasemeKind,
				spelledSurface: params.spelledSurface,
			}),
	};
}

export function makeLexemeMeta(params: {
	senseEmojis: string[];
	lemma: string;
	pos?: LexemePos;
	surfaceKind?: Exclude<SurfaceKind, "Unknown">;
}): LexicalMeta {
	return createLexicalMeta({
		senseEmojis: params.senseEmojis,
		selection: makeLexemeSelection(params),
	});
}

export function makePhrasemeMeta(params: {
	senseEmojis: string[];
	lemma: string;
	phrasemeKind?: PhrasemeKind;
}): LexicalMeta {
	return createLexicalMeta({
		senseEmojis: params.senseEmojis,
		selection: makePhrasemeSelection(params),
	});
}

export function makeNounInflections(
	input: Omit<Extract<LexemeInflections, { kind: "noun" }>, "kind">,
): Extract<LexemeInflections, { kind: "noun" }> {
	return { kind: "noun", ...input };
}

export function makeRelations(
	relations: LexicalRelations["relations"],
): LexicalInfo["relations"] {
	return {
		status: "ready",
		value: {
			relations,
		},
	};
}

export function makeMorphemicBreakdown(
	value: MorphemicBreakdown,
): LexicalInfo["morphemicBreakdown"] {
	return {
		status: "ready",
		value,
	};
}

export type { LemmaResult };
