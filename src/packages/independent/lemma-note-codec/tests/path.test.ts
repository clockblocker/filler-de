import { describe, expect, it } from "bun:test";
import { ParsingError, parseAsLemmaRecord } from "dumdict";
import { syncretize } from "dumling";
import type * as Dumling from "dumling/types";
import {
	canonicalFormBasename,
	decodeBasename,
	lemmaNotePath,
	parseNotePath,
	shadowNotePath,
} from "../src";
import { sha256Hex } from "../src/hash";

type DeLemma = Dumling.Lemma<"de">;

function lemma(
	family: string,
	kind: string,
	canonicalForm: string,
	coreFeatures: Record<string, unknown>,
): DeLemma {
	const candidate = {
		canonicalForm,
		coreFeatures,
		family,
		kind,
		language: "de",
		unitKind: "Lemma",
	};
	const parsed = parseAsLemmaRecord({ lemma: candidate }, "de");
	if (parsed instanceof ParsingError)
		throw new Error(`Invalid fixture ${canonicalForm}: ${parsed.message}`);
	return parsed.lemma;
}

const pronoun = (canonicalForm: string, core: Record<string, unknown>) =>
	lemma("Lexeme", "PRON", canonicalForm, {
		case: null,
		gender: null,
		number: null,
		person: null,
		polite: null,
		poss: null,
		pronType: null,
		...core,
	});

const determiner = (canonicalForm: string, core: Record<string, unknown>) =>
	lemma("Lexeme", "DET", canonicalForm, {
		case: null,
		gender: null,
		number: null,
		person: null,
		polite: null,
		poss: null,
		pronType: null,
		...core,
	});

const ihm = (gender: "Masc" | "Neut") =>
	pronoun("ihm", {
		case: "Dat",
		gender,
		number: "Sing",
		person: "3",
		pronType: "Prs",
	});

/** Every example of ADR 0013, with the Lemma it spells. */
const ADR_EXAMPLES: readonly [string, DeLemma][] = [
	["Worter/de/Lexeme/PRON/Prs/3/Masc/Sing/Dat/ihm.md", ihm("Masc")],
	[
		"Worter/de/Lexeme/PRON/Prs/3/~/Sing/Dat/ihm.md",
		syncretize([ihm("Masc"), ihm("Neut")]),
	],
	[
		"Worter/de/Lexeme/PRON/Prs/3/_/Plur/Nom/_/Form/Sie.md",
		pronoun("Sie", {
			case: "Nom",
			number: "Plur",
			person: "3",
			polite: "Form",
			pronType: "Prs",
		}),
	],
	[
		"Worter/de/Lexeme/DET/Art/_/Masc/Sing/Nom/der.md",
		determiner("der", {
			case: "Nom",
			gender: "Masc",
			number: "Sing",
			pronType: "Art",
		}),
	],
	[
		"Worter/de/Lexeme/DET/Dem/dieser.md",
		determiner("dieser", { pronType: "Dem" }),
	],
	[
		"Worter/de/Lexeme/NOUN/Masc/See.md",
		lemma("Lexeme", "NOUN", "See", { gender: "Masc" }),
	],
	[
		"Worter/de/Lexeme/NOUN/Masc+Neut/Balg.md",
		lemma("Lexeme", "NOUN", "Balg", {
			gender: { mixed: ["Masc", "Neut"] },
		}),
	],
	[
		"Worter/de/Lexeme/VERB/über/übersetzen.md",
		lemma("Lexeme", "VERB", "übersetzen", {
			hasSepPrefix: "über",
			lexicallyReflexive: null,
		}),
	],
	[
		"Worter/de/Lexeme/VERB/übersetzen.md",
		lemma("Lexeme", "VERB", "übersetzen", {
			hasSepPrefix: null,
			lexicallyReflexive: null,
		}),
	],
	[
		"Worter/de/Lexeme/ADJ/comparable/schön.md",
		lemma("Lexeme", "ADJ", "schön", { comparable: "Yes" }),
	],
	["Worter/de/Lexeme/ADP/mit.md", lemma("Lexeme", "ADP", "mit", {})],
];

const setFeatures = (core: Readonly<Record<string, unknown>>) =>
	Object.fromEntries(
		Object.entries(core).filter(
			([, value]) => value !== null && value !== undefined,
		),
	);

describe("lemmaNotePath", () => {
	for (const [expected, source] of ADR_EXAMPLES) {
		it(`spells ${expected}`, () => {
			expect(lemmaNotePath(source).path).toBe(expected);
		});

		it(`parses ${expected} back to the Lemma's identity`, () => {
			const parsed = parseNotePath(expected);
			if (!parsed.ok) throw new Error(parsed.error.reason);
			const { value } = parsed;
			if (value.type !== "lemma")
				throw new Error("Expected a Lemma path");
			expect({
				canonicalForm: value.basename.truncated
					? undefined
					: value.basename.canonicalForm,
				core: setFeatures(value.coreFeatures),
				family: value.family,
				kind: value.kind,
				syncretic: value.syncretic,
			}).toEqual({
				canonicalForm: source.canonicalForm,
				core: setFeatures(source.coreFeatures),
				family: source.family,
				kind: source.kind,
				syncretic: "syncretic" in source ? source.syncretic : undefined,
			});
		});
	}

	it("writes a reflexive verb's case as its value, after a null prefix slot", () => {
		const schaemen = lemma("Lexeme", "VERB", "schämen", {
			hasSepPrefix: null,
			lexicallyReflexive: "Acc",
		});
		expect(lemmaNotePath(schaemen).path).toBe(
			"Worter/de/Lexeme/VERB/_/Acc/schämen.md",
		);
	});

	it("spells Foreign, Morpheme, Locution and Saying routes", () => {
		expect(
			lemmaNotePath(
				lemma("Foreign", "Foreign", "c'est la vie", {
					sourceLang: "fr",
				}),
			).path,
		).toBe("Worter/de/Foreign/Foreign/fr/c'est la vie.md");
		expect(
			lemmaNotePath(
				lemma("Morpheme", "Prefix", "auf", { hasSepPrefix: "auf" }),
			).path,
		).toBe("Worter/de/Morpheme/Prefix/auf/auf.md");
		expect(
			lemmaNotePath(lemma("Locution", "VERB", "ins Gras beißen", {}))
				.path,
		).toBe("Worter/de/Locution/VERB/ins Gras beißen.md");
		expect(
			lemmaNotePath(
				lemma("Saying", "Saying", "Wer rastet, der rostet", {}),
			).path,
		).toBe("Worter/de/Saying/Saying/Wer rastet, der rostet.md");
	});
});

describe("shadowNotePath", () => {
	it("puts a Shadow under Worter/<lang>/Shadow/<Family>/<Kind>/", () => {
		const path = shadowNotePath({
			canonicalForm: "Elternteil",
			family: "Lexeme",
			kind: "NOUN",
			language: "de",
		});
		expect(path.path).toBe("Worter/de/Shadow/Lexeme/NOUN/Elternteil.md");
		expect(parseNotePath(path.path)).toEqual({
			ok: true,
			value: {
				basename: { canonicalForm: "Elternteil", truncated: false },
				family: "Lexeme",
				kind: "NOUN",
				language: "de",
				type: "shadow",
			},
		});
	});
});

describe("basenames", () => {
	it("percent-encodes exactly the reserved characters, % first", () => {
		const form = 'a%b*c"d\\e/f<g>h:i|j?k#l^m[n]o …ü~+_';
		const basename = canonicalFormBasename(form);
		expect(basename).toBe(
			"a%25b%2Ac%22d%5Ce%2Ff%3Cg%3Eh%3Ai%7Cj%3Fk%23l%5Em%5Bn%5Do …ü%7E+_",
		);
		expect(decodeBasename(basename)).toEqual({
			canonicalForm: form,
			truncated: false,
		});
	});

	it("escapes a leading dot and edge whitespace, so no name is hidden or trimmed", () => {
		expect(canonicalFormBasename(".")).toBe("%2E");
		expect(canonicalFormBasename("..")).toBe("%2E.");
		expect(canonicalFormBasename(" a b ")).toBe("%20a b%20");
		expect(canonicalFormBasename("a\tb")).toBe("a%09b");
		for (const form of [".", "..", " a b ", "a\tb", "x~deadbeef"])
			expect(decodeBasename(canonicalFormBasename(form))).toEqual({
				canonicalForm: form,
				truncated: false,
			});
		expect(decodeBasename("%2Ea")).toEqual({
			canonicalForm: ".a",
			truncated: false,
		});
		expect(decodeBasename("a%2E")).toBeUndefined();
		expect(decodeBasename(".a")).toBeUndefined();
		expect(decodeBasename("%41")).toBeUndefined();
	});

	it("never reads a full form as a shortened one", () => {
		const form = `${"a".repeat(79)}~deadbeef`;
		expect(decodeBasename(canonicalFormBasename(form))).toEqual({
			canonicalForm: form,
			truncated: false,
		});
	});

	it("keeps a shortened prefix that ends in a space", () => {
		const form = `${"b".repeat(79)} ${"c".repeat(30)}`;
		const basename = canonicalFormBasename(form);
		expect(decodeBasename(basename)).toEqual({
			canonicalFormPrefix: `${"b".repeat(79)} `,
			hash: sha256Hex(form).slice(0, 8),
			truncated: true,
		});
	});

	it("keeps display casing", () => {
		expect(canonicalFormBasename("LOL")).toBe("LOL");
	});

	it("shortens a basename longer than 100 characters to 80, ~ and a hash", () => {
		const form = `${"Wer anderen eine Grube gräbt, fällt selbst hinein ".repeat(3)}und so`;
		const basename = canonicalFormBasename(form);
		const hash = sha256Hex(form).slice(0, 8);
		expect(basename).toBe(
			`${Array.from(form).slice(0, 80).join("")}~${hash}`,
		);
		expect(decodeBasename(basename)).toEqual({
			canonicalFormPrefix: Array.from(form).slice(0, 80).join(""),
			hash,
			truncated: true,
		});
	});

	it("never splits an escape or a surrogate pair when shortening", () => {
		const form = `${"x".repeat(79)}?${"🙂".repeat(40)}`;
		const basename = canonicalFormBasename(form);
		expect(basename.startsWith(`${"x".repeat(79)}~`)).toBe(true);
		const emoji = `${"y".repeat(79)}${"🙂".repeat(40)}`;
		const short = canonicalFormBasename(emoji);
		expect(Array.from(short.split("~")[0] ?? "").length).toBe(80);
		expect(decodeBasename(short)).toMatchObject({ truncated: true });
	});

	it("keeps a 100-character basename whole", () => {
		const form = "z".repeat(100);
		expect(canonicalFormBasename(form)).toBe(form);
	});
});

describe("parseNotePath rejects what lemmaNotePath never writes", () => {
	const invalid = [
		"Worter/de/Lexeme/NOUN/Masc/See.txt",
		"Other/de/Lexeme/NOUN/Masc/See.md",
		"Worter/en/Lexeme/NOUN/Masc/See.md",
		"Worter/de/Lexeme/NOUN/Masc/_/See.md",
		"Worter/de/Lexeme/NOUN/_/See.md",
		"Worter/de/Lexeme/WORD/See.md",
		"Worter/de/Lexeme/ADJ/gradable/schön.md",
		"Worter/de/Lexeme/NOUN/Ma-sc/See.md",
		"Worter/de/Lexeme/NOUN/Masc/a?b.md",
		"Worter/de/Shadow/Lexeme/NOUN/extra/See.md",
		"Worter/de/Lexeme.md",
		"Worter/de/Lexeme/VERB//stehen.md",
		"Worter/de/Lexeme/NOUN/Masc+Masc/Balg.md",
		"Worter/de/Lexeme/NOUN/Neut+Masc/Balg.md",
		"Worter/de/Lexeme/VERB/%C3%BCber/übersetzen.md",
		"Worter/de/Lexeme/NOUN/Masc/a~b.md",
	];
	for (const path of invalid) {
		it(path, () => {
			const parsed = parseNotePath(path);
			expect(parsed.ok).toBe(false);
			if (!parsed.ok) expect(parsed.error._tag).toBe("InvalidNotePath");
		});
	}

	it("round-trips a text slot that reads as a slot symbol", () => {
		// dumling rejects this value; the encoding still stays reversible.
		const odd = {
			canonicalForm: "x",
			coreFeatures: { sourceLang: "_" },
			family: "Foreign",
			kind: "Foreign",
			language: "de",
		} as const;
		const { path } = lemmaNotePath(odd);
		expect(path).toBe("Worter/de/Foreign/Foreign/%5F/x.md");
		expect(
			lemmaNotePath({
				...odd,
				coreFeatures: { sourceLang: ".." },
			}).path,
		).toBe("Worter/de/Foreign/Foreign/%2E./x.md");
		const parsed = parseNotePath(path);
		expect(
			parsed.ok &&
				parsed.value.type === "lemma" &&
				parsed.value.coreFeatures,
		).toEqual({
			sourceLang: "_",
		});
	});
});
