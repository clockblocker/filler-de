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
	 * A masculine noun with an -(e)n plural may be weak (Mensch, des
	 * Menschen), which the stored data cannot tell, so its oblique singular
	 * cells are left out. `Staat` is a known false positive.
	 */
	readonly possibleNDeclension: boolean;
};

/**
 * The genitive singular of a masculine or neuter noun: `-es` after s, ß, x,
 * z and sch, `-s` with an S-plural, `-es` for a monosyllable, `-s`
 * otherwise (measured in #62). A final vowel takes `-s` (Knie, Schnee), a
 * doubled plural `s` doubles here too (Bus, Busse, des Busses), and a
 * foreign `-us` whose plural replaces it is unchanged (Rhythmus, Rhythmen).
 */
function masculineOrNeuterGenitive(
	singular: string,
	plurals: readonly string[],
): string {
	const base = lower(singular);
	const folded = plurals.map(lower);
	if (endsWithVowel(base)) return `${singular}s`;
	if (
		base.endsWith("s") &&
		folded.some((plural) => plural.startsWith(`${base}s`))
	)
		return `${singular}ses`;
	if (
		base.endsWith("us") &&
		folded.length > 0 &&
		!folded.some((plural) => plural.startsWith(base))
	)
		return singular;
	if (endsWithSibilant(base) || base.endsWith("sch")) return `${singular}es`;
	if (folded.includes(`${base}s`)) return `${singular}s`;
	if (syllableCount(base) === 1) return `${singular}es`;
	return `${singular}s`;
}

/**
 * The dative plural adds `-n` unless the plural ends in `-n`, `-s` or a vowel
 * other than `e`: Tagen, Fahrern, but Teams, Kommata.
 */
function dativePlural(plural: string): string {
	return /[nsaiouyäöü]$/iu.test(plural) ? plural : `${plural}n`;
}

function singularForm(
	grammaticalCase: Case,
	gender: Gender,
	singular: string,
	plurals: readonly string[],
): string {
	if (grammaticalCase !== "Gen" || gender === "Fem") return singular;
	return masculineOrNeuterGenitive(singular, plurals);
}

function isPossibleNDeclension(
	singular: string,
	genders: readonly Gender[],
	plurals: readonly string[],
): boolean {
	const base = lower(singular);
	return (
		genders.includes("Masc") &&
		plurals.some(
			(plural) =>
				lower(plural) === `${base}n` || lower(plural) === `${base}en`,
		)
	);
}

/**
 * A German noun's case table from its Canonical Form, Core gender and stored
 * plural, with dumcorpus's definite article cells. The nominative and
 * accusative singular are the Lemma, every plural cell is a stored plural,
 * and a feminine singular never changes. Undefined when the data cannot
 * fill a table: a noun with neither gender nor `PluralOnly`.
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
			possibleNDeclension: false,
		};
	if (genders.length === 0) return undefined;
	const plurals = plural === "NoPlural" ? [] : plural;
	const possibleNDeclension = isPossibleNDeclension(
		canonicalForm,
		genders,
		plurals,
	);
	const cells: NounCell[] = [];
	for (const grammaticalCase of CASES) {
		const oblique = grammaticalCase !== "Nom";
		if (!(possibleNDeclension && oblique)) {
			const articles = genders.map((gender) =>
				definiteArticle(grammaticalCase, "Sing", gender),
			);
			const forms = distinct(
				genders.map((gender) =>
					singularForm(
						grammaticalCase,
						gender,
						canonicalForm,
						plurals,
					),
				),
			);
			const [form] = forms;
			// Genders that disagree on the form leave the cell out.
			if (
				form !== undefined &&
				forms.length === 1 &&
				articles.every((article) => article !== undefined)
			)
				cells.push({
					article: distinct(articles as string[]).join("/"),
					case: grammaticalCase,
					form,
					number: "Sing",
				});
		}
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
	return { cells, possibleNDeclension };
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
