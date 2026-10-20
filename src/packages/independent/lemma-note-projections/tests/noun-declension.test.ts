import { describe, expect, it } from "bun:test";
import {
	declineGermanNoun,
	deriveInflection,
	type Gender,
	type GermanNounInput,
	type NounCell,
} from "../src";
import { input, noun } from "./fixtures";

/**
 * The 5 Flexion tables of the dev vault's generated entries (#62), copied
 * from `Worter/` with their wikilinks. Each holds 8 cells.
 */
const VAULT_TABLES: readonly {
	readonly lemma: string;
	readonly gender: Gender;
	readonly plural: string;
	readonly flexion: string;
}[] = [
	{
		flexion: `N: der [[Tag]], die [[Tage]]
A: den [[Tag]], die [[Tage]]
G: des [[Tages]], der [[Tage]]
D: dem [[Tag]], den [[Tagen]]`,
		gender: "Masc",
		lemma: "Tag",
		plural: "Tage",
	},
	{
		flexion: `N: das [[Team]], die [[Teams]]
A: das [[Team]], die [[Teams]]
G: des [[Teams]], der [[Teams]]
D: dem [[Team]], den [[Teams]]`,
		gender: "Neut",
		lemma: "Team",
		plural: "Teams",
	},
	{
		flexion: `N: das [[Formular]], die [[Formulare]]
A: das [[Formular]], die [[Formulare]]
G: des [[Formulars]], der [[Formulare]]
D: dem [[Formular]], den [[Formularen]]`,
		gender: "Neut",
		lemma: "Formular",
		plural: "Formulare",
	},
	{
		flexion: `N: der [[Fahrer]], die [[Fahrer]]
A: den [[Fahrer]], die [[Fahrer]]
G: des [[Fahrers]], der [[Fahrer]]
D: dem [[Fahrer]], den [[Fahrern]]`,
		gender: "Masc",
		lemma: "Fahrer",
		plural: "Fahrer",
	},
	{
		flexion: `N: die [[Fahrkarte]], die [[Fahrkarten]]
A: die [[Fahrkarte]], die [[Fahrkarten]]
G: der [[Fahrkarte]], der [[Fahrkarten]]
D: der [[Fahrkarte]], den [[Fahrkarten]]`,
		gender: "Fem",
		lemma: "Fahrkarte",
		plural: "Fahrkarten",
	},
];

const CASE_OF: Readonly<Record<string, NounCell["case"]>> = {
	A: "Acc",
	D: "Dat",
	G: "Gen",
	N: "Nom",
};

/** The vault table's cells, as `case number: article form`. */
function vaultCells(flexion: string): string[] {
	return flexion.split("\n").flatMap((line) => {
		const [label = "", rest = ""] = line.split(": ");
		return rest.split(", ").map((cell, index) => {
			const text = cell.replace(/\[\[|\]\]/gu, "");
			return `${CASE_OF[label]} ${index === 0 ? "Sing" : "Plur"}: ${text}`;
		});
	});
}

function cellsOf(nounInput: GermanNounInput): string[] {
	const declension = declineGermanNoun(nounInput);
	if (declension === undefined) throw new Error("Expected a declension");
	return declension.cells.map(
		(cell) => `${cell.case} ${cell.number}: ${cell.article} ${cell.form}`,
	);
}

describe("the dev vault's Flexion tables", () => {
	it("holds 40 cells", () => {
		const total = VAULT_TABLES.flatMap(({ flexion }) =>
			vaultCells(flexion),
		).length;
		expect(total).toBe(40);
	});

	for (const { flexion, gender, lemma, plural } of VAULT_TABLES) {
		it(`derives all 8 cells of ${lemma}`, () => {
			expect(
				cellsOf({
					canonicalForm: lemma,
					genders: [gender],
					plural: [plural],
				}),
			).toEqual(vaultCells(flexion));
		});

		it(`renders ${lemma}'s table as the vault shows it, without links`, () => {
			expect(
				deriveInflection(
					input(noun(lemma, gender), { plural: [plural] }),
				),
			).toBe(flexion.replace(/\[\[|\]\]/gu, ""));
		});
	}
});

/** The 18 other measured vault nouns (#62): gender, plural, Gen Sg, Dat Pl. */
const VAULT_NOUNS: readonly (readonly [
	string,
	Gender,
	string,
	string,
	string,
])[] = [
	["Abend", "Masc", "Abende", "Abends", "Abenden"],
	["Antrag", "Masc", "Anträge", "Antrags", "Anträgen"],
	["Kopf", "Masc", "Köpfe", "Kopfes", "Köpfen"],
	["Nachweis", "Masc", "Nachweise", "Nachweises", "Nachweisen"],
	["Preis", "Masc", "Preise", "Preises", "Preisen"],
	["Ticket", "Neut", "Tickets", "Tickets", "Tickets"],
	[
		"Gültigkeitsdatum",
		"Neut",
		"Gültigkeitsdaten",
		"Gültigkeitsdatums",
		"Gültigkeitsdaten",
	],
	["Nacht", "Fem", "Nächte", "Nacht", "Nächten"],
	["Person", "Fem", "Personen", "Person", "Personen"],
	["Arm", "Masc", "Arme", "Armes", "Armen"],
	["Bein", "Neut", "Beine", "Beines", "Beinen"],
	["Dokument", "Neut", "Dokumente", "Dokuments", "Dokumenten"],
	["Gruppe", "Fem", "Gruppen", "Gruppe", "Gruppen"],
	["Mitglied", "Neut", "Mitglieder", "Mitglieds", "Mitgliedern"],
	["Papier", "Neut", "Papiere", "Papiers", "Papieren"],
	["Pass", "Masc", "Pässe", "Passes", "Pässen"],
	["Mietvertrag", "Masc", "Mietverträge", "Mietvertrags", "Mietverträgen"],
	["Zeitraum", "Masc", "Zeiträume", "Zeitraums", "Zeiträumen"],
];

describe("the 18 other vault nouns", () => {
	it("covers 18 nouns", () => expect(VAULT_NOUNS.length).toBe(18));

	for (const [lemma, gender, plural, genitive, dative] of VAULT_NOUNS)
		it(`${lemma}: des/der ${genitive}, den ${dative}`, () => {
			const cells = declineGermanNoun({
				canonicalForm: lemma,
				genders: [gender],
				plural: [plural],
			})?.cells;
			const form = (grammaticalCase: string, number: string) =>
				cells?.find(
					(cell) =>
						cell.case === grammaticalCase && cell.number === number,
				)?.form;
			expect(form("Gen", "Sing")).toBe(genitive);
			expect(form("Dat", "Plur")).toBe(dative);
		});
});

describe("possible n-Deklination", () => {
	for (const [lemma, plural] of [
		["Mensch", "Menschen"],
		["Kollege", "Kollegen"],
		["Name", "Namen"],
	] as const)
		it(`omits ${lemma}'s oblique singular cells`, () => {
			const declension = declineGermanNoun({
				canonicalForm: lemma,
				genders: ["Masc"],
				plural: [plural],
			});
			expect(declension?.possibleNDeclension).toBe(true);
			expect(
				declension?.cells
					.filter((cell) => cell.number === "Sing")
					.map((cell) => cell.case),
			).toEqual(["Nom"]);
			expect(
				declension?.cells.filter((cell) => cell.number === "Plur"),
			).toHaveLength(4);
		});

	it("flags Staat too, the known false positive", () => {
		expect(
			declineGermanNoun({
				canonicalForm: "Staat",
				genders: ["Masc"],
				plural: ["Staaten"],
			})?.possibleNDeclension,
		).toBe(true);
	});

	it("renders the omission", () => {
		expect(
			deriveInflection(
				input(noun("Mensch", "Masc"), { plural: ["Menschen"] }),
			),
		).toBe(`N: der Mensch, die Menschen
A: die Menschen
G: der Menschen
D: den Menschen`);
	});
});

describe("other plural shapes", () => {
	it("gives a NoPlural noun its singular cells only", () => {
		expect(
			cellsOf({
				canonicalForm: "Schnee",
				genders: ["Masc"],
				plural: "NoPlural",
			}),
		).toEqual([
			"Nom Sing: der Schnee",
			"Acc Sing: den Schnee",
			"Gen Sing: des Schnees",
			"Dat Sing: dem Schnee",
		]);
	});

	it("gives a PluralOnly noun its plural cells from the Canonical Form", () => {
		expect(
			cellsOf({
				canonicalForm: "Leute",
				genders: [],
				plural: "PluralOnly",
			}),
		).toEqual([
			"Nom Plur: die Leute",
			"Acc Plur: die Leute",
			"Gen Plur: der Leute",
			"Dat Plur: den Leuten",
		]);
	});

	it("lists every stored plural", () => {
		expect(
			cellsOf({
				canonicalForm: "Komma",
				genders: ["Neut"],
				plural: ["Kommas", "Kommata"],
			}).filter((cell) => cell.startsWith("Dat")),
		).toEqual([
			"Dat Sing: dem Komma",
			"Dat Plur: den Kommas",
			"Dat Plur: den Kommata",
		]);
	});

	it("doubles a plural's doubled s and keeps a replaced -us", () => {
		const genitive = (lemma: string, plural: string) =>
			declineGermanNoun({
				canonicalForm: lemma,
				genders: ["Masc"],
				plural: [plural],
			})?.cells.find(
				(cell) => cell.case === "Gen" && cell.number === "Sing",
			)?.form;
		expect(genitive("Bus", "Busse")).toBe("Busses");
		expect(genitive("Rhythmus", "Rhythmen")).toBe("Rhythmus");
	});

	it("joins the articles of a mixed gender and drops cells its genders disagree on", () => {
		expect(
			cellsOf({
				canonicalForm: "Balg",
				genders: ["Masc", "Neut"],
				plural: ["Bälger"],
			}).filter((cell) => cell.includes("Sing")),
		).toEqual([
			"Nom Sing: der/das Balg",
			"Acc Sing: den/das Balg",
			"Gen Sing: des Balges",
			"Dat Sing: dem Balg",
		]);
		expect(
			cellsOf({
				canonicalForm: "Joghurt",
				genders: ["Masc", "Fem"],
				plural: ["Joghurts"],
			}).filter((cell) => cell.startsWith("Gen Sing")),
		).toEqual([]);
	});

	it("derives nothing without a stored plural or a gender", () => {
		expect(deriveInflection(input(noun("Tag", "Masc")))).toBeUndefined();
		expect(
			declineGermanNoun({
				canonicalForm: "Reisende",
				genders: [],
				plural: ["Reisende"],
			}),
		).toBeUndefined();
	});
});
