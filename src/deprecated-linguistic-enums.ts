type ValueOf<T> = T[keyof T];

export const OrthographicStatus = {
	Standard: "Standard",
	Typo: "Typo",
	Unknown: "Unknown",
} as const;
export type OrthographicStatus = ValueOf<typeof OrthographicStatus>;

export const SurfaceKind = {
	Inflection: "Inflection",
	Lemma: "Lemma",
	Variant: "Variant",
	Partial: "Partial",
} as const;
export type SurfaceKind = ValueOf<typeof SurfaceKind>;

export const LemmaKind = {
	Lexeme: "Lexeme",
	Phraseme: "Phraseme",
	Morpheme: "Morpheme",
} as const;
export type LemmaKind = ValueOf<typeof LemmaKind>;

export const Case = {
	Acc: "Acc",
	Abe: "Abe",
	Ben: "Ben",
	Cau: "Cau",
	Cmp: "Cmp",
	Cns: "Cns",
	Com: "Com",
	Dat: "Dat",
	Dis: "Dis",
	Equ: "Equ",
	Gen: "Gen",
	Ins: "Ins",
	Par: "Par",
	Tem: "Tem",
	Abl: "Abl",
	Add: "Add",
	Ade: "Ade",
	All: "All",
	Del: "Del",
	Ela: "Ela",
	Ess: "Ess",
	Ill: "Ill",
	Ine: "Ine",
	Lat: "Lat",
	Loc: "Loc",
	Nom: "Nom",
	Per: "Per",
	Sbe: "Sbe",
	Sbl: "Sbl",
	Spl: "Spl",
	Sub: "Sub",
	Sup: "Sup",
	Ter: "Ter",
} as const;
export type Case = ValueOf<typeof Case>;

export const Gender = {
	Com: "Com",
	Fem: "Fem",
	Masc: "Masc",
	Neut: "Neut",
} as const;
export type Gender = ValueOf<typeof Gender>;

export const GrammaticalNumber = {
	Coll: "Coll",
	Count: "Count",
	Dual: "Dual",
	Grpa: "Grpa",
	Grpl: "Grpl",
	Inv: "Inv",
	Pauc: "Pauc",
	Plur: "Plur",
	Ptan: "Ptan",
	Sing: "Sing",
	Tri: "Tri",
} as const;
export type GrammaticalNumber = ValueOf<typeof GrammaticalNumber>;

export const MorphemeKind = {
	Root: "Root",
	Prefix: "Prefix",
	Suffix: "Suffix",
	Suffixoid: "Suffixoid",
	Infix: "Infix",
	Circumfix: "Circumfix",
	Interfix: "Interfix",
	Transfix: "Transfix",
	Clitic: "Clitic",
	ToneMarking: "ToneMarking",
	Duplifix: "Duplifix",
} as const;
export type MorphemeKind = ValueOf<typeof MorphemeKind>;

export const PhrasemeKind = {
	DiscourseFormula: "DiscourseFormula",
	Cliché: "Cliché",
	Aphorism: "Aphorism",
	Proverb: "Proverb",
	Idiom: "Idiom",
} as const;
export type PhrasemeKind = ValueOf<typeof PhrasemeKind>;

export const Pos = {
	ADJ: "ADJ",
	ADV: "ADV",
	INTJ: "INTJ",
	NOUN: "NOUN",
	PROPN: "PROPN",
	VERB: "VERB",
	ADP: "ADP",
	AUX: "AUX",
	CCONJ: "CCONJ",
	DET: "DET",
	NUM: "NUM",
	PART: "PART",
	PRON: "PRON",
	SCONJ: "SCONJ",
	PUNCT: "PUNCT",
	SYM: "SYM",
	X: "X",
} as const;
export type Pos = ValueOf<typeof Pos>;

type DeprecatedInherentFeatureValue = string | boolean | undefined;

// This is a compatibility alias for the app-facing subset previously derived
// from the native linguistics model. It is intentionally structural, not exact.
export type InherentFeatures = Partial<{
	abbr: "Yes";
	animacy: string;
	aspect: string;
	case: Case;
	clusivity: string;
	definite: string;
	degree: string;
	deixis: string;
	deixisRef: string;
	evident: string;
	extPos: Pos;
	foreign: "Yes";
	gender: Gender;
	governedCase: Case;
	governedPreposition: string;
	lexicallyReflexive: "Yes";
	mood: string;
	nounClass: string;
	number: GrammaticalNumber;
	numType: string;
	person: string;
	phrasal: "Yes";
	polarity: string;
	polite: string;
	poss: string;
	pronType: string;
	reflex: "Yes";
	separable: "Yes";
	tense: string;
	verbForm: string;
	voice: string;
}> &
	Record<string, DeprecatedInherentFeatureValue>;

export type UnknownSelection = {
	orthographicStatus: typeof OrthographicStatus.Unknown;
};
