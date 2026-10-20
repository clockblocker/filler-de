import { describe, expect, it } from "bun:test";
import { authoredMembers } from "dumcorpus/inventories";
import type * as Dumling from "dumling/types";
import { compareGerman, deriveInflection, renderTable } from "../src";
import { input, lexeme, verb } from "./fixtures";

function compared(
	positive: string,
	storedComparatives: string[] = [],
	derive = true,
) {
	return renderTable(
		compareGerman({ canonicalForm: positive, derive, storedComparatives }),
	);
}

describe("comparison", () => {
	for (const [positive, comparative, superlative] of [
		["schnell", "schneller", "am schnellsten"],
		["langsam", "langsamer", "am langsamsten"],
		["dunkel", "dunkler", "am dunkelsten"],
		["teuer", "teurer", "am teuersten"],
		["leise", "leiser", "am leisesten"],
		["müde", "müder", "am müdesten"],
		["leicht", "leichter", "am leichtesten"],
		["frei", "freier", "am freiesten"],
		["interessant", "interessanter", "am interessantesten"],
		["typisch", "typischer", "am typischsten"],
		["spät", "später", "am spätesten"],
		["begeistert", "begeisterter", "am begeistertsten"],
		["gebildet", "gebildeter", "am gebildetsten"],
		["interessiert", "interessierter", "am interessiertesten"],
	] as const)
		it(`derives ${positive}, ${comparative}, ${superlative}`, () => {
			expect(compared(positive)).toBe(
				`Positiv: ${positive}\nKomparativ: ${comparative}\nSuperlativ: ${superlative}`,
			);
		});

	it("takes suppletive forms from dumcorpus", () => {
		expect(compared("gut")).toBe(
			"Positiv: gut\nKomparativ: besser\nSuperlativ: am besten",
		);
		expect(compared("gern")).toBe(
			"Positiv: gern\nKomparativ: lieber\nSuperlativ: am liebsten",
		);
		expect(compared("gerne", [], false)).toBe(
			"Positiv: gerne\nKomparativ: lieber\nSuperlativ: am liebsten",
		);
	});

	it("derives nothing regular for an ADV", () => {
		expect(compared("sehr", [], false)).toBeUndefined();
		expect(
			deriveInflection(
				input(lexeme("ADV", "lange", { comparable: "Yes" })),
			),
		).toBeUndefined();
	});

	it("leaves out a monosyllable that may umlaut, unless a Surface stores it", () => {
		expect(compared("alt")).toBeUndefined();
		expect(compared("klar")).toBeUndefined();
		expect(compared("lange")).toBeUndefined();
		expect(compared("nahe")).toBeUndefined();
		expect(compared("gesund")).toBeUndefined();
		expect(compared("alt", ["älter"])).toBe(
			"Positiv: alt\nKomparativ: älter",
		);
	});

	it("renders only where Core marks the Lemma comparable", () => {
		expect(
			deriveInflection(
				input(lexeme("ADJ", "schnell", { comparable: "Yes" })),
			),
		).toBe(
			"Positiv: schnell\nKomparativ: schneller\nSuperlativ: am schnellsten",
		);
		expect(
			deriveInflection(input(lexeme("ADJ", "tot", { comparable: null }))),
		).toBeUndefined();
	});

	it("reads a stored comparative from an owned uninflected Surface", () => {
		const alt = lexeme("ADJ", "alt", { comparable: "Yes" });
		const surface = {
			inflectionalFeatures: { degree: "Cmp" },
			language: "de",
			lemma: alt,
			normalizedSurface: "älter",
			spelling: { kind: "Canonical" },
			surfaceFeatures: null,
			unitKind: "Surface",
		} as unknown as Dumling.Surface;
		expect(deriveInflection(input(alt, undefined, [{ surface }]))).toBe(
			"Positiv: alt\nKomparativ: älter",
		);
	});
});

function authoredLemma(
	predicate: (lemma: Dumling.Lemma<"de">) => boolean,
): Dumling.Lemma<"de"> {
	const member = authoredMembers.find(({ lemma }) => predicate(lemma));
	if (member === undefined) throw new Error("No such authored member");
	return member.lemma;
}

describe("closed-class paradigms from dumcorpus", () => {
	it("gives a declining determiner stem its case table", () => {
		const dieser = authoredLemma(
			(lemma) => lemma.kind === "DET" && lemma.canonicalForm === "dieser",
		);
		expect(deriveInflection(input(dieser))).toBe(
			`N: dieser (m), dieses (n), diese (f), diese (pl)
A: diesen (m), dieses (n), diese (f), diese (pl)
G: dieses (m), dieses (n), dieser (f), dieser (pl)
D: diesem (m), diesem (n), dieser (f), diesen (pl)`,
		);
	});

	it("lists a modal verb's forms", () => {
		expect(deriveInflection(input(verb("sollen")))).toBe(
			"Formen: sollen, soll, sollst, sollt, sollte, solltest, sollten, solltet, solle, sollest, sollet, gesollt",
		);
	});

	it("lists an auxiliary's forms", () => {
		const sein = authoredLemma(
			(lemma) => lemma.kind === "AUX" && lemma.canonicalForm === "sein",
		);
		const forms = deriveInflection(input(sein));
		expect(forms?.startsWith("Formen: sein, bin, bist, ist")).toBe(true);
		for (const form of ["hab", "hätt", "ward"])
			expect(forms?.split(": ")[1]?.split(", ")).not.toContain(form);
	});

	it("drops a modal's pre-reform ß spellings", () => {
		const forms = deriveInflection(input(verb("müssen")));
		expect(forms).toContain("muss");
		expect(forms).not.toContain("muß");
	});

	it("gives an AUX that shares several verbs' forms no table", () => {
		const bekommen = authoredLemma(
			(lemma) =>
				lemma.kind === "AUX" && lemma.canonicalForm === "bekommen",
		);
		expect(deriveInflection(input(bekommen))).toBeUndefined();
	});

	it("gives a pillar cell no table", () => {
		const der = authoredLemma(
			(lemma) => lemma.kind === "DET" && lemma.canonicalForm === "der",
		);
		expect(deriveInflection(input(der))).toBeUndefined();
	});
});
