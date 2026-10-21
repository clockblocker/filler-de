/**
 * How one Core Feature is spelled in its path slot (ADR 0013).
 *
 * - `value`: a closed value, written verbatim (`Masc`, `3`, `Form`).
 * - `flag`: a feature whose only value is `Yes`, written as its name
 *   (`comparable`).
 * - `text`: an open string, such as `hasSepPrefix`, written as its value
 *   (`über`) through `toNameSegment` (ADR-0015), or percent-encoded in the
 *   legacy ADR-0013 layout.
 * - `valueSet`: one closed value, or a noun's `{ mixed: [...] }` value set
 *   written with `+` (`Masc+Neut`).
 */
export type SlotEncoding = "value" | "flag" | "text" | "valueSet";

export type Slot = {
	readonly feature: string;
	readonly encoding: SlotEncoding;
};

const value = (feature: string): Slot => ({ encoding: "value", feature });
const flag = (feature: string): Slot => ({ encoding: "flag", feature });
const text = (feature: string): Slot => ({ encoding: "text", feature });

/** PRON and DET: pronType, person, gender, number, case, then poss and polite. */
const pronominal: readonly Slot[] = [
	value("pronType"),
	value("person"),
	value("gender"),
	value("number"),
	value("case"),
	flag("poss"),
	value("polite"),
];

const comparable: readonly Slot[] = [flag("comparable")];

/**
 * The positional Core Feature slots of every German route, from coarse to
 * fine (ADR 0013), keyed by Family and then Kind. A route with no Core
 * Features has no slots. New features are only ever appended to a route's
 * list, so existing notes keep their paths.
 *
 * `tests/slot-table.test.ts` checks every route and feature against
 * dumling's route schemas, so a new route or Core Feature fails the build
 * until it gets a slot here.
 */
export const GERMAN_SLOT_TABLE = {
	Foreign: { Foreign: [text("sourceLang")] },
	Lexeme: {
		ADJ: comparable,
		ADP: [],
		ADV: comparable,
		AUX: [],
		CCONJ: [],
		DET: pronominal,
		INTJ: [value("partType")],
		NOUN: [{ encoding: "valueSet", feature: "gender" }],
		NUM: [],
		PART: [value("partType"), value("polarity")],
		PRON: pronominal,
		PROPN: [value("article"), value("gender")],
		PUNCT: [],
		SCONJ: [],
		SYM: [],
		VERB: [text("hasSepPrefix"), value("lexicallyReflexive")],
	},
	Locution: {
		ADJ: comparable,
		ADP: [],
		ADV: comparable,
		CCONJ: [],
		DET: [],
		INTJ: [],
		NOUN: [value("gender")],
		NUM: [],
		PRON: [],
		SCONJ: [],
		VERB: [],
	},
	Morpheme: {
		Circumfix: [],
		Duplifix: [],
		Infix: [],
		Interfix: [],
		Prefix: [text("hasSepPrefix")],
		Root: [],
		Suffix: [],
		Suffixoid: [],
	},
	Saying: { Saying: [] },
} as const satisfies Readonly<
	Record<string, Readonly<Record<string, readonly Slot[]>>>
>;

/** The slots of a German route, or undefined for a route the table lacks. */
export function germanSlotsOf(
	family: string,
	kind: string,
): readonly Slot[] | undefined {
	const kinds: Readonly<
		Record<string, Readonly<Record<string, readonly Slot[]>>>
	> = GERMAN_SLOT_TABLE;
	const byKind = Object.hasOwn(kinds, family) ? kinds[family] : undefined;
	return byKind !== undefined && Object.hasOwn(byKind, kind)
		? byKind[kind]
		: undefined;
}
