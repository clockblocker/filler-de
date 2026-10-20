import { distinct, type InflectionTable } from "../table";
import {
	CASE_LABELS,
	CASES,
	type Case,
	definiteArticle,
	type Gender,
	type GrammaticalNumber,
} from "./articles";
import {
	endsWithSibilant,
	endsWithVowel,
	lower,
	syllableCount,
} from "./orthography";

export type GermanNounInput = {
	/** The nominative singular, or the plural of a plurale tantum. */
	readonly canonicalForm: string;
	/** NOUN Core `gender`: one, the members of a `mixed` gender, or none. */
	readonly genders: readonly Gender[];
	/** dumrel `plural`: the stored plural forms, `NoPlural` or `PluralOnly`. */
	readonly plural: readonly string[] | "NoPlural" | "PluralOnly";
	/**
	 * Singular forms the Lemma's owned Surfaces attest, by case (`Staates`
	 * for Gen). They win over derivation and fill the cells it leaves out.
	 */
	readonly attestedSingular?:
		| Readonly<Partial<Record<Case, readonly string[]>>>
		| undefined;
};

/** One derived cell: `des Tages` is Gen Sing. */
export type NounCell = {
	readonly case: Case;
	readonly number: GrammaticalNumber;
	readonly article: string;
	readonly form: string;
};

export type NounDeclension = {
	/** The cells in table order: by case, the singular before the plurals. */
	readonly cells: readonly NounCell[];
	/**
	 * The stored data cannot tell whether the noun follows the
	 * n-Deklination. A masculine noun with an -(e)n plural or a final `-e`
	 * may be weak (Mensch, des Menschen; Glaube, des Glaubens) or not
	 * (Staat, des Staates; Käse, des Käses), and Herz declines like a weak
	 * noun. No weak form is ever derived, so its oblique singular cells come
	 * only from attested Surfaces.
	 */
	readonly nDeclensionUnknown: boolean;
};

/** Umlauts folded, so a plural compares with its singular: `häuser` → `hauser`. */
function withoutUmlauts(word: string): string {
	return word.replace(/ä/gu, "a").replace(/ö/gu, "o").replace(/ü/gu, "u");
}

/**
 * The genitive singular of a masculine or neuter noun, by the rules
 * measured in #62: `-es` after s, ß, x, z and sch, `-s` with an S-plural,
 * `-es` for a monosyllable, `-s` otherwise. Undefined wherever the data
 * leaves the ending in doubt, rather than a guess:
 *
 * - a final vowel takes `-s` (Knie, Schnee, Auge);
 * - the suffix `-nis` doubles its s (des Verständnisses), unlike Tennis;
 * - another single final `s` takes `-es` only where a plural shows it
 *   (Preise, Häuser), doubles where a plural doubles it (Busse), and keeps
 *   the singular for a foreign `-us` (Rhythmus, Tourismus) or an unchanged
 *   plural (Status). Chaos, Kosmos, Atlas, Tennis and Applaus get none;
 * - another sibilant takes `-es` in a monosyllable (Pass, Fuß, Stress) or
 *   where a plural shows it, and keeps an unchanged plural's singular
 *   (Quiz). Business, Jazz and Kommerz get none;
 * - a monosyllable with no stored plural may be a loan that takes only `-s`
 *   (Rock, Golf, Smog), so it gets none.
 */
function masculineOrNeuterGenitive(
	singular: string,
	plurals: readonly string[],
): string | undefined {
	const base = lower(singular);
	const stem = withoutUmlauts(base);
	const folded = plurals.map((plural) => withoutUmlauts(lower(plural)));
	const extended = folded.some(
		(plural) => plural.length > stem.length && plural.startsWith(stem),
	);
	const unchanged = folded.includes(stem);
	const monosyllable = syllableCount(base) === 1;
	if (endsWithVowel(base)) return `${singular}s`;
	if (/[^aeiouyäöün]nis$/u.test(base)) return `${singular}ses`;
	if (base.endsWith("s") && !base.endsWith("ss")) {
		if (folded.some((plural) => plural.startsWith(`${stem}s`)))
			return `${singular}ses`;
		if (extended) return `${singular}es`;
		if (unchanged || (!monosyllable && /[^aeiouyäöü]us$/u.test(base)))
			return singular;
		return undefined;
	}
	if (endsWithSibilant(base) || base.endsWith("sch")) {
		if (unchanged) return singular;
		if (base.endsWith("zz")) return undefined;
		return monosyllable || extended ? `${singular}es` : undefined;
	}
	if (folded.includes(`${stem}s`)) return `${singular}s`;
	if (monosyllable) return plurals.length > 0 ? `${singular}es` : undefined;
	return `${singular}s`;
}

/**
 * The dative plural adds `-n` unless the plural ends in `-n`, `-s` or a vowel
 * other than `e`: Tagen, Fahrern, but Teams, Kommata.
 */
function dativePlural(plural: string): string {
	return /[nsaiouyäöü]$/iu.test(plural) ? plural : `${plural}n`;
}

/**
 * A neuter in `-e` with no plural may be an adjective used as a noun (das
 * Böse, des Bösen, dem Bösen) or not (das Getreide, des Getreides), so its
 * genitive and dative singular are in doubt.
 */
function mayBeAdjectival(
	singular: string,
	gender: Gender,
	plurals: readonly string[],
): boolean {
	return (
		gender === "Neut" &&
		plurals.length === 0 &&
		/[^aeiouyäöü]e$/u.test(lower(singular))
	);
}

/** A strong singular cell's form; undefined where it is in doubt. */
function singularForm(
	grammaticalCase: Case,
	gender: Gender,
	singular: string,
	plurals: readonly string[],
): string | undefined {
	if (grammaticalCase === "Nom" || grammaticalCase === "Acc") return singular;
	if (gender === "Fem") return singular;
	if (mayBeAdjectival(singular, gender, plurals)) return undefined;
	if (grammaticalCase === "Dat") return singular;
	return masculineOrNeuterGenitive(singular, plurals);
}

function isNDeclensionUnknown(
	singular: string,
	genders: readonly Gender[],
	plurals: readonly string[],
): boolean {
	const base = lower(singular);
	const enPlural = plurals.some(
		(plural) =>
			lower(plural) === `${base}n` || lower(plural) === `${base}en`,
	);
	if (genders.includes("Masc"))
		return enPlural || (base.endsWith("e") && !base.endsWith("ee"));
	// Herz (des Herzens) stays weak whatever plural is stored.
	return genders.includes("Neut") && base.endsWith("herz");
}

/** The singular forms of one case: attested ones, else one certain derived form. */
function singularForms(
	grammaticalCase: Case,
	input: GermanNounInput,
	plurals: readonly string[],
	nDeclensionUnknown: boolean,
): string[] {
	const attested = distinct(input.attestedSingular?.[grammaticalCase] ?? []);
	if (attested.length > 0) return attested;
	if (nDeclensionUnknown && grammaticalCase !== "Nom") return [];
	const derived = input.genders.map((gender) =>
		singularForm(grammaticalCase, gender, input.canonicalForm, plurals),
	);
	// A form in doubt, or genders that disagree on the form, leave it out.
	if (derived.some((form) => form === undefined)) return [];
	const forms = distinct(derived as string[]);
	return forms.length === 1 ? forms : [];
}

/**
 * A German noun's case table from its Canonical Form, Core gender and stored
 * plural, with dumcorpus's definite article cells. The nominative singular
 * is the Lemma, every plural cell is a stored plural, a feminine singular
 * never changes, and a singular form an owned Surface attests wins. Any
 * other cell whose form is in doubt is left out, never guessed: no weak
 * (n-Deklination) form is derived. Undefined when the data cannot fill a
 * table: a noun with neither gender nor `PluralOnly`.
 */
export function declineGermanNoun(
	input: GermanNounInput,
): NounDeclension | undefined {
	const { canonicalForm, genders, plural } = input;
	if (plural === "PluralOnly")
		return {
			cells: CASES.flatMap((grammaticalCase) => {
				const article = definiteArticle(grammaticalCase, "Plur", null);
				return article === undefined
					? []
					: [
							{
								article,
								case: grammaticalCase,
								form:
									grammaticalCase === "Dat"
										? dativePlural(canonicalForm)
										: canonicalForm,
								number: "Plur" as const,
							},
						];
			}),
			nDeclensionUnknown: false,
		};
	if (genders.length === 0) return undefined;
	const plurals = plural === "NoPlural" ? [] : plural;
	const nDeclensionUnknown = isNDeclensionUnknown(
		canonicalForm,
		genders,
		plurals,
	);
	const cells: NounCell[] = [];
	for (const grammaticalCase of CASES) {
		const articles = genders.map((gender) =>
			definiteArticle(grammaticalCase, "Sing", gender),
		);
		if (articles.every((article) => article !== undefined))
			for (const form of singularForms(
				grammaticalCase,
				input,
				plurals,
				nDeclensionUnknown,
			))
				cells.push({
					article: distinct(articles as string[]).join("/"),
					case: grammaticalCase,
					form,
					number: "Sing",
				});
		const article = definiteArticle(grammaticalCase, "Plur", null);
		if (article === undefined) continue;
		for (const stored of plurals)
			cells.push({
				article,
				case: grammaticalCase,
				form: grammaticalCase === "Dat" ? dativePlural(stored) : stored,
				number: "Plur",
			});
	}
	return { cells, nDeclensionUnknown };
}

/** `N: der Tag, die Tage`, one row per case. */
export function nounTable(declension: NounDeclension): InflectionTable {
	return {
		rows: CASES.map((grammaticalCase) => ({
			cells: declension.cells
				.filter((cell) => cell.case === grammaticalCase)
				.map((cell) => `${cell.article} ${cell.form}`),
			label: CASE_LABELS[grammaticalCase],
		})),
	};
}
