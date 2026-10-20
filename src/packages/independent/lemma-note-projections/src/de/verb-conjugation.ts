import { germanInseparablePrefixes } from "dumcorpus/inventories";
import type * as Dumrel from "dumrel/types";
import { distinct, type InflectionTable, type TableRow } from "../table";
import { endsWithSibilant, hasVowel, lower } from "./orthography";

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
	} else if (word.endsWith("en")) stem = infinitive.slice(0, -2);
	else if (word.endsWith("n")) stem = infinitive.slice(0, -1);
	else return undefined;
	if (!hasVowel(stem)) return undefined;
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
 * right: `vernachlässigen` and `besuchen` do, `beten`, `ernten`, `bellen`
 * and `beugen` do not.
 */
function hasInseparablePrefix(infinitive: string): boolean {
	const word = lower(infinitive);
	return [...germanInseparablePrefixes, ...DUAL_PREFIXES].some((prefix) => {
		if (!word.startsWith(prefix)) return false;
		const rest = word.slice(prefix.length);
		if (/^(.)\1/u.test(rest)) return false;
		if (prefix.endsWith("e") && /^[iu]/u.test(rest)) return false;
		return analyze(rest) !== undefined;
	});
}

function takesGe(infinitive: string): boolean {
	return !(
		lower(infinitive).endsWith("ieren") || hasInseparablePrefix(infinitive)
	);
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

/**
 * A German verb's conjugation from its Canonical Form, Core and stored
 * Knowledge. A weak verb gets Präsens, Präteritum, Konjunktiv II
 * (= Präteritum), Partizip II and Imperativ, with the separable particle and
 * the reflexive in place. Any other verb, or one with no stored class, gets
 * the Präsens cells every non-closed verb forms regularly (ich, wir, ihr,
 * sie), the Präteritum from its stored `preterite`, and a Partizip II only
 * from a stored `-te` form (gebracht). The rest, and the haben/sein
 * auxiliary, are left out rather than guessed. Undefined when the Canonical
 * Form is not one word once its particle and `sich` are removed.
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

	const stored = input.preterite?.map((form) => finiteOf(form, particle));
	if (stored?.some((form) => form === undefined)) return undefined;
	const preterites = distinct(
		(stored as string[] | undefined) ?? (weak ? [weakPreterite(stem)] : []),
	);

	const present = presentForms(stem);
	const presentPersons: readonly Person[] = weak
		? PERSONS
		: lower(infinitive) === "wissen"
			? ["wir", "ihr", "sie"]
			: ["ich", "wir", "ihr", "sie"];
	const personRow = (
		label: string,
		forms: Record<Person, string>,
		persons: readonly Person[] = PERSONS,
	): TableRow => ({
		cells: persons.map((person) => clause(person, forms[person], shape)),
		label,
	});
	const ge = takesGe(infinitive) ? "ge" : "";
	const dentalPreterites = preterites.filter((form) => form.endsWith("te"));

	const rows: TableRow[] = [
		personRow("Präsens", present, presentPersons),
		...preterites.map((form) => personRow("Präteritum", pastForms(form))),
		...(weak
			? dentalPreterites.map((form) =>
					personRow("Konjunktiv II", pastForms(form)),
				)
			: []),
		{
			cells: distinct(
				dentalPreterites.map(
					(form) => `${particle ?? ""}${ge}${form.slice(0, -1)}`,
				),
			),
			label: "Partizip II",
		},
		...(weak
			? [{ cells: imperative(stem, shape), label: "Imperativ" }]
			: []),
	];
	return { rows: rows.filter((row) => row.cells.length > 0) };
}
