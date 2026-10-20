import { germanInseparablePrefixes } from "dumcorpus/inventories";
import type * as Dumrel from "dumrel/types";
import { distinct, type InflectionTable, type TableRow } from "../table";
import {
	endsWithSibilant,
	hasVowel,
	lower,
	syllableCount,
} from "./orthography";

export type GermanVerbInput = {
	/** The infinitive as dumling cites it: `aufpassen`, `sich hüten`. */
	readonly canonicalForm: string;
	/** VERB Core `hasSepPrefix`. */
	readonly separablePrefix: string | null;
	/** VERB Core `lexicallyReflexive`: the reflexive's case. */
	readonly reflexive: "Acc" | "Dat" | null;
	/** dumrel `conjugationClass`. */
	readonly conjugationClasses: readonly Dumrel.ConjugationClass[] | undefined;
	/** dumrel `preterite`: stored third person singular Präteritum forms. */
	readonly preterite: readonly string[] | undefined;
	/** dumrel `presentSingular`: stored Präsens forms of each singular person. */
	readonly presentSingular?:
		| {
				readonly first: readonly string[];
				readonly second: readonly string[];
				readonly third: readonly string[];
		  }
		| undefined;
	/** dumrel `pastParticiple`: stored Partizip II forms, particle included. */
	readonly pastParticiple?: readonly string[] | undefined;
	/** dumrel `subjunctivePast`: stored third person singular Konjunktiv II forms. */
	readonly subjunctivePast?: readonly string[] | undefined;
};

const PERSONS = ["ich", "du", "er", "wir", "ihr", "sie"] as const;
type Person = (typeof PERSONS)[number];

const REFLEXIVE: Readonly<Record<"Acc" | "Dat", Record<Person, string>>> = {
	Acc: {
		du: "dich",
		er: "sich",
		ich: "mich",
		ihr: "euch",
		sie: "sich",
		wir: "uns",
	},
	Dat: {
		du: "dir",
		er: "sich",
		ich: "mir",
		ihr: "euch",
		sie: "sich",
		wir: "uns",
	},
};

/**
 * Prefixes that also form inseparable verbs. A verb whose Core names no
 * separable prefix and that starts with one is inseparable (übersetzen,
 * unterschreiben), so its participle takes no `ge-`.
 */
const DUAL_PREFIXES = [
	"durch",
	"hinter",
	"über",
	"um",
	"unter",
	"voll",
	"wider",
	"wieder",
] as const;

type Stem = {
	/** The infinitive without particle or `sich`. */
	readonly infinitive: string;
	/** `pass`, `hüt`, `sammel`, `wander`. */
	readonly stem: string;
	/** `-eln` and `-ern` verbs keep their `e` and end the infinitive in `-n`. */
	readonly kind: "regular" | "el" | "er";
	/** Endings beginning with a consonant take an `e`: hütest, rechnet. */
	readonly needsE: boolean;
};

/**
 * A stem whose endings need a linking `e`: one in t or d, or in m or n after
 * another consonant that is not l, r, m, n or a lengthening h (atmen,
 * rechnen, öffnen; not filmen, lärmen, wohnen).
 */
function needsLinkingE(stem: string): boolean {
	const word = lower(stem);
	if (/[td]$/u.test(word)) return true;
	const match = /([^aeiouyäöü])([mn])$/u.exec(word);
	if (match === null) return false;
	const before = match[1] ?? "";
	if ("lrmn".includes(before)) return false;
	if (before === "h") return !/[aeiouyäöü]h[mn]$/u.test(word);
	return true;
}

function analyze(infinitive: string): Stem | undefined {
	const word = lower(infinitive);
	let stem: string;
	let kind: Stem["kind"] = "regular";
	if (word.endsWith("eln")) {
		stem = infinitive.slice(0, -1);
		kind = "el";
	} else if (word.endsWith("ern")) {
		stem = infinitive.slice(0, -1);
		kind = "er";
	} else if (/[^e]ien$/u.test(word))
		// knien keeps its stem's e (ich knie), which no rule here spells.
		return undefined;
	else if (word.endsWith("en")) stem = infinitive.slice(0, -2);
	else if (word.endsWith("n")) stem = infinitive.slice(0, -1);
	else return undefined;
	// The `e` of -eln and -ern is no stem vowel: entern is no ent- verb.
	if (!hasVowel(kind === "regular" ? stem : stem.slice(0, -2)))
		return undefined;
	return {
		infinitive,
		kind,
		needsE: kind === "regular" && needsLinkingE(stem),
		stem,
	};
}

/**
 * Whether the infinitive starts with an inseparable prefix from dumcorpus
 * (be-, ver-, …) or a dual one, before a stem that is a verb in its own
 * right: `vernachlässigen` and `besuchen` do, `beten`, `ernten` and `bellen`
 * do not. After be- or ge-, an i or u may open the stem (beurteilen,
 * beinhalten) or a diphthong of a plain verb (beugen, geigen), so the
 * answer there is unknown.
 */
function prefixStatus(infinitive: string): "inseparable" | "none" | "unknown" {
	const word = lower(infinitive);
	let status: "inseparable" | "none" | "unknown" = "none";
	for (const prefix of [...germanInseparablePrefixes, ...DUAL_PREFIXES]) {
		if (!word.startsWith(prefix)) continue;
		const rest = word.slice(prefix.length);
		if (/^(.)\1/u.test(rest) || analyze(rest) === undefined) continue;
		if (prefix.endsWith("e") && /^[iu]/u.test(rest)) status = "unknown";
		else return "inseparable";
	}
	return status;
}

/**
 * Verbs whose Präteritum is weak but whose participle is strong
 * (backte, gebacken), so no `-te` form gives it.
 */
const STRONG_PARTICIPLES: ReadonlySet<string> = new Set([
	"backen",
	"hauen",
	"mahlen",
	"melken",
	"salzen",
	"schinden",
	"sieden",
	"spalten",
	"weben",
]);

function hasStrongParticiple(infinitive: string): boolean {
	const word = lower(infinitive);
	return (
		STRONG_PARTICIPLES.has(word) ||
		[...germanInseparablePrefixes].some(
			(prefix) =>
				word.startsWith(prefix) &&
				STRONG_PARTICIPLES.has(word.slice(prefix.length)),
		)
	);
}

/**
 * The syllables of a stem before its unstressed endings: the `e` of -eln
 * and -ern and a final `-ig` (`sammel` → `samm`, `kündig` → `künd`).
 */
function rootSyllables(stem: Stem): number {
	const root = stem.kind === "regular" ? stem.stem : stem.stem.slice(0, -2);
	const unsuffixed = root.replace(/ig$/iu, "");
	return syllableCount(hasVowel(unsuffixed) ? unsuffixed : root);
}

/**
 * Whether the participle takes `ge-`, which only a stressed first syllable
 * takes. It does not after an inseparable prefix or for a verb in stressed
 * `-ieren` (ignoriert, but geschmiert), and does for a verb with no prefix
 * whose root is one syllable, which carries the stress (gepasst,
 * gehandelt, gekündigt). Undefined when that cannot be told: a longer
 * root may stress its first syllable (gearbeitet) or not (trompetet,
 * posaunt, prophezeit), and only a dictionary knows which.
 */
function takesGe(stem: Stem): boolean | undefined {
	const { infinitive } = stem;
	if (/[aeiouyäöü][^aeiouyäöü]*ieren$/u.test(lower(infinitive))) return false;
	const status = prefixStatus(infinitive);
	if (status === "unknown") return undefined;
	if (status === "inseparable") return false;
	return rootSyllables(stem) === 1 ? true : undefined;
}

type Shape = {
	readonly particle: string | null;
	readonly reflexive: "Acc" | "Dat" | null;
};

/** `ich passe auf`, `du hütest dich`, `wir passen uns an`. */
function clause(person: Person, finite: string, shape: Shape): string {
	return [
		person,
		finite,
		shape.reflexive === null
			? undefined
			: REFLEXIVE[shape.reflexive][person],
		shape.particle ?? undefined,
	]
		.filter((word) => word !== undefined)
		.join(" ");
}

function presentForms(stem: Stem): Record<Person, string> {
	const { infinitive, kind, needsE } = stem;
	const base = stem.stem;
	if (kind === "el")
		return {
			du: `${base}st`,
			er: `${base}t`,
			ich: `${base.slice(0, -2)}le`,
			ihr: `${base}t`,
			sie: infinitive,
			wir: infinitive,
		};
	const third = `${base}${needsE ? "et" : "t"}`;
	return {
		du: needsE
			? `${base}est`
			: endsWithSibilant(base)
				? `${base}t`
				: `${base}st`,
		er: third,
		ich: `${base}e`,
		ihr: third,
		sie: infinitive,
		wir: infinitive,
	};
}

/** The person forms of a Präteritum from its third person singular. */
function pastForms(finite: string): Record<Person, string> {
	if (finite.endsWith("e"))
		return {
			du: `${finite}st`,
			er: finite,
			ich: finite,
			ihr: `${finite}t`,
			sie: `${finite}n`,
			wir: `${finite}n`,
		};
	const dental = /[td]$/u.test(finite);
	return {
		du: dental || endsWithSibilant(finite) ? `${finite}est` : `${finite}st`,
		er: finite,
		ich: finite,
		ihr: dental ? `${finite}et` : `${finite}t`,
		sie: `${finite}en`,
		wir: `${finite}en`,
	};
}

function weakPreterite(stem: Stem): string {
	return stem.kind === "regular" && stem.needsE
		? `${stem.stem}ete`
		: `${stem.stem}te`;
}

function imperativeSingular(stem: Stem): string {
	if (stem.kind === "el") return `${stem.stem.slice(0, -2)}le`;
	if (stem.kind === "er") return `${stem.stem}e`;
	return stem.needsE || /ig$/u.test(lower(stem.stem))
		? `${stem.stem}e`
		: stem.stem;
}

function imperative(stem: Stem, shape: Shape): string[] {
	const tail = (pronoun: string | undefined) =>
		[pronoun, shape.particle ?? undefined]
			.filter((word) => word !== undefined)
			.map((word) => ` ${word}`)
			.join("");
	const reflexive = shape.reflexive;
	const plural = presentForms(stem).ihr;
	return [
		`${imperativeSingular(stem)}${tail(reflexive === null ? undefined : REFLEXIVE[reflexive].du)}!`,
		`${plural}${tail(reflexive === null ? undefined : "euch")}!`,
		`${stem.infinitive} Sie${tail(reflexive === null ? undefined : "sich")}!`,
	];
}

/** A stored form split into its finite word; undefined if its particle is not the verb's. */
function finiteOf(form: string, particle: string | null): string | undefined {
	const [finite, ...rest] = form.split(" ");
	if (finite === undefined || finite.length === 0) return undefined;
	const split = rest.join(" ");
	if (particle === null) return split.length === 0 ? finite : undefined;
	return lower(split) === lower(particle) ? finite : undefined;
}

/** The finite words of stored forms, each once, without those {@link finiteOf} rejects. */
function finiteForms(
	forms: readonly string[] | undefined,
	particle: string | null,
): string[] {
	return distinct(
		(forms ?? [])
			.map((form) => finiteOf(form, particle))
			.filter((form) => form !== undefined),
	);
}

/**
 * Stored Partizip II forms that are one word and, for a separable verb,
 * open with its particle (`abgefahren`); others are left out.
 */
function storedParticiples(
	forms: readonly string[] | undefined,
	particle: string | null,
): string[] {
	return distinct(
		(forms ?? []).filter(
			(form) =>
				/^\S+$/u.test(form) &&
				(particle === null ||
					(lower(form).startsWith(lower(particle)) &&
						form.length > particle.length)),
		),
	);
}

/**
 * A German verb's conjugation from its Canonical Form, Core and stored
 * Knowledge. Stored forms win over rules (ADR 0038): `presentSingular` gives
 * the ich, du and er cells, `preterite` the Präteritum, `subjunctivePast`
 * the Konjunktiv II and `pastParticiple` the Partizip II, for any class.
 * Without them, a weak verb derives Präsens, Präteritum, Konjunktiv II
 * (= Präteritum), Partizip II and Imperativ, with the separable particle and
 * the reflexive in place. Any other verb, or one with no stored class, gets
 * the Präsens cells every non-closed verb forms regularly (ich, wir, ihr,
 * sie; wissen drops ich) and a Partizip II only from a stored `-te` form
 * (gebracht). The rest, the haben/sein auxiliary, a participle whose `ge-`
 * is in doubt and a stored form whose particle is not the verb's are left
 * out rather than guessed. A stored aspect is never filled in from rules.
 * Undefined when the Canonical Form is not one word once its particle and
 * `sich` are removed, or its stem is one no rule here spells (knien).
 */
export function conjugateGermanVerb(
	input: GermanVerbInput,
): InflectionTable | undefined {
	let infinitive = input.canonicalForm.replace(/^sich\s+/u, "");
	const particle = input.separablePrefix;
	if (particle !== null) {
		if (!lower(infinitive).startsWith(lower(particle))) return undefined;
		infinitive = infinitive.slice(particle.length);
	}
	if (/\s/u.test(infinitive)) return undefined;
	const stem = analyze(infinitive);
	if (stem === undefined) return undefined;
	const shape: Shape = { particle, reflexive: input.reflexive };
	const classes = input.conjugationClasses ?? [];
	const weak =
		classes.length > 0 && classes.every((value) => value === "Weak");

	const preterites =
		input.preterite === undefined
			? weak
				? [weakPreterite(stem)]
				: []
			: finiteForms(input.preterite, particle);

	const derivedPresent = presentForms(stem);
	const derivedPersons: readonly Person[] = weak
		? PERSONS
		: lower(infinitive) === "wissen"
			? ["wir", "ihr", "sie"]
			: ["ich", "wir", "ihr", "sie"];
	const stored = input.presentSingular;
	const storedPresent: Partial<Record<Person, readonly string[]>> =
		stored === undefined
			? {}
			: {
					du: finiteForms(stored.second, particle),
					er: finiteForms(stored.third, particle),
					ich: finiteForms(stored.first, particle),
				};
	const present: TableRow = {
		cells: PERSONS.flatMap((person) =>
			(
				storedPresent[person] ??
				(derivedPersons.includes(person)
					? [derivedPresent[person]]
					: [])
			).map((finite) => clause(person, finite, shape)),
		),
		label: "Präsens",
	};

	const personRow = (label: string, finite: string): TableRow => {
		const forms = pastForms(finite);
		return {
			cells: PERSONS.map((person) =>
				clause(person, forms[person], shape),
			),
			label,
		};
	};
	const dentalPreterites = preterites.filter((form) => form.endsWith("te"));
	// A Konjunktiv II form ends in -e, so it takes a -te Präteritum's person
	// endings (führe, führest, führen).
	const subjunctives =
		input.subjunctivePast === undefined
			? weak
				? dentalPreterites
				: []
			: finiteForms(input.subjunctivePast, particle).filter((form) =>
					form.endsWith("e"),
				);
	const ge = takesGe(stem);
	const participles =
		input.pastParticiple !== undefined
			? storedParticiples(input.pastParticiple, particle)
			: ge === undefined || hasStrongParticiple(infinitive)
				? []
				: dentalPreterites.map(
						(form) =>
							`${particle ?? ""}${ge ? "ge" : ""}${form.slice(0, -1)}`,
					);

	const rows: TableRow[] = [
		present,
		...preterites.map((form) => personRow("Präteritum", form)),
		...subjunctives.map((form) => personRow("Konjunktiv II", form)),
		{ cells: distinct(participles), label: "Partizip II" },
		...(weak
			? [{ cells: imperative(stem, shape), label: "Imperativ" }]
			: []),
	];
	return { rows: rows.filter((row) => row.cells.length > 0) };
}
