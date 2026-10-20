import { describe, expect, it } from "bun:test";
import {
	conjugateGermanVerb,
	deriveInflection,
	type GermanVerbInput,
} from "../src";
import { input, verb } from "./fixtures";

function rows(
	canonicalForm: string,
	options: Partial<Omit<GermanVerbInput, "canonicalForm">> = {},
): Record<string, string[]> {
	const table = conjugateGermanVerb({
		canonicalForm,
		conjugationClasses: options.conjugationClasses,
		preterite: options.preterite,
		reflexive: options.reflexive ?? null,
		separablePrefix: options.separablePrefix ?? null,
	});
	if (table === undefined) throw new Error("Expected a table");
	const byLabel: Record<string, string[]> = {};
	for (const row of table.rows)
		byLabel[row.label] = [
			...(byLabel[row.label] ?? []),
			row.cells.join(", "),
		];
	return byLabel;
}

const weak = { conjugationClasses: ["Weak"] } as const;

/** Every row of the 5 weak vault verbs (#62). */
describe("the dev vault's weak verbs", () => {
	it("aufpassen places its particle", () => {
		const past =
			"ich passte auf, du passtest auf, er passte auf, wir passten auf, ihr passtet auf, sie passten auf";
		expect(rows("aufpassen", { ...weak, separablePrefix: "auf" })).toEqual({
			Imperativ: ["pass auf!, passt auf!, passen Sie auf!"],
			"Konjunktiv II": [past],
			"Partizip II": ["aufgepasst"],
			Präsens: [
				"ich passe auf, du passt auf, er passt auf, wir passen auf, ihr passt auf, sie passen auf",
			],
			Präteritum: [past],
		});
	});

	it("passen", () => {
		const past =
			"ich passte, du passtest, er passte, wir passten, ihr passtet, sie passten";
		expect(rows("passen", weak)).toEqual({
			Imperativ: ["pass!, passt!, passen Sie!"],
			"Konjunktiv II": [past],
			"Partizip II": ["gepasst"],
			Präsens: [
				"ich passe, du passt, er passt, wir passen, ihr passt, sie passen",
			],
			Präteritum: [past],
		});
	});

	it("ignorieren takes no ge-", () => {
		const past =
			"ich ignorierte, du ignoriertest, er ignorierte, wir ignorierten, ihr ignoriertet, sie ignorierten";
		expect(rows("ignorieren", weak)).toEqual({
			Imperativ: ["ignorier!, ignoriert!, ignorieren Sie!"],
			"Konjunktiv II": [past],
			"Partizip II": ["ignoriert"],
			Präsens: [
				"ich ignoriere, du ignorierst, er ignoriert, wir ignorieren, ihr ignoriert, sie ignorieren",
			],
			Präteritum: [past],
		});
	});

	it("vernachlässigen keeps its inseparable prefix", () => {
		const past =
			"ich vernachlässigte, du vernachlässigtest, er vernachlässigte, wir vernachlässigten, ihr vernachlässigtet, sie vernachlässigten";
		expect(rows("vernachlässigen", weak)).toEqual({
			Imperativ: [
				"vernachlässige!, vernachlässigt!, vernachlässigen Sie!",
			],
			"Konjunktiv II": [past],
			"Partizip II": ["vernachlässigt"],
			Präsens: [
				"ich vernachlässige, du vernachlässigst, er vernachlässigt, wir vernachlässigen, ihr vernachlässigt, sie vernachlässigen",
			],
			Präteritum: [past],
		});
	});

	it("sich hüten places its reflexive and links its t-stem with e", () => {
		const past =
			"ich hütete mich, du hütetest dich, er hütete sich, wir hüteten uns, ihr hütetet euch, sie hüteten sich";
		expect(rows("sich hüten", { ...weak, reflexive: "Acc" })).toEqual({
			Imperativ: ["hüte dich!, hütet euch!, hüten Sie sich!"],
			"Konjunktiv II": [past],
			"Partizip II": ["gehütet"],
			Präsens: [
				"ich hüte mich, du hütest dich, er hütet sich, wir hüten uns, ihr hütet euch, sie hüten sich",
			],
			Präteritum: [past],
		});
	});

	it("renders through the inflection hook", () => {
		expect(
			deriveInflection(
				input(verb("aufpassen", { hasSepPrefix: "auf" }), {
					conjugationClass: ["Weak"],
				}),
			)?.split("\n")[3],
		).toBe("Partizip II: aufgepasst");
	});
});

/** The 3 strong vault verbs (#62), before dumgen stored their Präteritum. */
describe("strong verbs without a stored Präteritum", () => {
	const strong = { conjugationClasses: ["Strong"] } as const;

	it("fahren gets only its regular Präsens cells", () => {
		expect(rows("fahren", strong)).toEqual({
			Präsens: ["ich fahre, wir fahren, ihr fahrt, sie fahren"],
		});
		expect(
			deriveInflection(
				input(verb("fahren"), { conjugationClass: ["Strong"] }),
			),
		).toBe("Präsens: ich fahre, wir fahren, ihr fahrt, sie fahren");
	});

	it("unterschreiben", () => {
		expect(rows("unterschreiben", strong).Präsens).toEqual([
			"ich unterschreibe, wir unterschreiben, ihr unterschreibt, sie unterschreiben",
		]);
	});

	it("achtgeben places its particle", () => {
		expect(
			rows("achtgeben", { ...strong, separablePrefix: "acht" }).Präsens,
		).toEqual([
			"ich gebe acht, wir geben acht, ihr gebt acht, sie geben acht",
		]);
	});

	it("a verb with no stored class gets the same reduced table", () => {
		expect(deriveInflection(input(verb("passen")))).toBe(
			"Präsens: ich passe, wir passen, ihr passt, sie passen",
		);
	});
});

describe("verbs with a stored Präteritum (texteater#1215)", () => {
	it("fahren gets its Präteritum from the stored form", () => {
		expect(
			deriveInflection(
				input(verb("fahren"), {
					conjugationClass: ["Strong"],
					preterite: ["fuhr"],
				}),
			),
		).toBe(`Präsens: ich fahre, wir fahren, ihr fahrt, sie fahren
Präteritum: ich fuhr, du fuhrst, er fuhr, wir fuhren, ihr fuhrt, sie fuhren`);
	});

	it("unterschreiben", () => {
		expect(
			rows("unterschreiben", {
				conjugationClasses: ["Strong"],
				preterite: ["unterschrieb"],
			}).Präteritum,
		).toEqual([
			"ich unterschrieb, du unterschriebst, er unterschrieb, wir unterschrieben, ihr unterschriebt, sie unterschrieben",
		]);
	});

	it("achtgeben and aufstehen keep their particle", () => {
		expect(
			rows("achtgeben", {
				conjugationClasses: ["Strong"],
				preterite: ["gab acht"],
				separablePrefix: "acht",
			}).Präteritum,
		).toEqual([
			"ich gab acht, du gabst acht, er gab acht, wir gaben acht, ihr gabt acht, sie gaben acht",
		]);
		expect(
			rows("aufstehen", {
				conjugationClasses: ["Strong"],
				preterite: ["stand auf"],
				separablePrefix: "auf",
			}).Präteritum,
		).toEqual([
			"ich stand auf, du standest auf, er stand auf, wir standen auf, ihr standet auf, sie standen auf",
		]);
	});

	it("a strong verb gets no Partizip II, Konjunktiv II or Imperativ", () => {
		const table = rows("lesen", {
			conjugationClasses: ["Strong"],
			preterite: ["las"],
		});
		expect(Object.keys(table)).toEqual(["Präsens", "Präteritum"]);
		expect(table.Präteritum).toEqual([
			"ich las, du lasest, er las, wir lasen, ihr last, sie lasen",
		]);
	});

	it("a mixed verb gets its Partizip II from the stored -te form", () => {
		expect(
			rows("bringen", {
				conjugationClasses: ["Mixed"],
				preterite: ["brachte"],
			}),
		).toEqual({
			"Partizip II": ["gebracht"],
			Präsens: ["ich bringe, wir bringen, ihr bringt, sie bringen"],
			Präteritum: [
				"ich brachte, du brachtest, er brachte, wir brachten, ihr brachtet, sie brachten",
			],
		});
		expect(
			rows("mitbringen", {
				conjugationClasses: ["Mixed"],
				preterite: ["brachte mit"],
				separablePrefix: "mit",
			})["Partizip II"],
		).toEqual(["mitgebracht"]);
	});

	it("a verb with two classes lists each stored form", () => {
		expect(
			rows("senden", {
				conjugationClasses: ["Mixed", "Weak"],
				preterite: ["sandte", "sendete"],
			}),
		).toEqual({
			"Partizip II": ["gesandt, gesendet"],
			Präsens: ["ich sende, wir senden, ihr sendet, sie senden"],
			Präteritum: [
				"ich sandte, du sandtest, er sandte, wir sandten, ihr sandtet, sie sandten",
				"ich sendete, du sendetest, er sendete, wir sendeten, ihr sendetet, sie sendeten",
			],
		});
	});

	it("a weak verb prefers its stored Präteritum", () => {
		expect(
			rows("abholen", {
				conjugationClasses: ["Weak"],
				preterite: ["holte ab"],
				separablePrefix: "ab",
			})["Partizip II"],
		).toEqual(["abgeholt"]);
	});

	it("leaves out a stored form whose particle is not the verb's", () => {
		expect(
			rows("aufstehen", {
				conjugationClasses: ["Strong"],
				preterite: ["stand", "stand auf"],
				separablePrefix: "auf",
			}).Präteritum,
		).toEqual([
			"ich stand auf, du standest auf, er stand auf, wir standen auf, ihr standet auf, sie standen auf",
		]);
		expect(
			rows("aufstehen", {
				conjugationClasses: ["Strong"],
				preterite: ["stand"],
				separablePrefix: "auf",
			}),
		).toEqual({
			Präsens: [
				"ich stehe auf, wir stehen auf, ihr steht auf, sie stehen auf",
			],
		});
	});

	it("leaves out the participle of a weak past with a strong participle", () => {
		expect(
			rows("backen", {
				conjugationClasses: ["Weak"],
				preterite: ["backte"],
			})["Partizip II"],
		).toBeUndefined();
	});
});

describe("forms left out rather than guessed", () => {
	it("a be- verb whose stem opens with i or u gets no participle", () => {
		expect(rows("beurteilen", weak)["Partizip II"]).toBeUndefined();
		expect(rows("beugen", weak)["Partizip II"]).toBeUndefined();
		expect(rows("beurteilen", weak).Präteritum).toEqual([
			"ich beurteilte, du beurteiltest, er beurteilte, wir beurteilten, ihr beurteiltet, sie beurteilten",
		]);
	});

	it("-ieren takes no ge- only after a stem vowel", () => {
		expect(rows("schmieren", weak)["Partizip II"]).toEqual(["geschmiert"]);
		expect(
			rows("abschmieren", { ...weak, separablePrefix: "ab" })[
				"Partizip II"
			],
		).toEqual(["abgeschmiert"]);
		expect(rows("studieren", weak)["Partizip II"]).toEqual(["studiert"]);
	});

	it("knien gets no table", () => {
		expect(
			conjugateGermanVerb({
				canonicalForm: "knien",
				conjugationClasses: ["Weak"],
				preterite: undefined,
				reflexive: null,
				separablePrefix: null,
			}),
		).toBeUndefined();
	});
});

describe("weak stems", () => {
	it("-eln and -ern verbs", () => {
		expect(rows("sammeln", weak).Präsens).toEqual([
			"ich sammle, du sammelst, er sammelt, wir sammeln, ihr sammelt, sie sammeln",
		]);
		expect(rows("wandern", weak).Imperativ).toEqual([
			"wandere!, wandert!, wandern Sie!",
		]);
	});

	it("links a consonant + n stem with e, but not after a lengthening h", () => {
		expect(rows("rechnen", weak).Präsens).toEqual([
			"ich rechne, du rechnest, er rechnet, wir rechnen, ihr rechnet, sie rechnen",
		]);
		expect(rows("wohnen", weak)["Partizip II"]).toEqual(["gewohnt"]);
	});

	it("tells an inseparable prefix from a stem that only looks like one", () => {
		expect(rows("besuchen", weak)["Partizip II"]).toEqual(["besucht"]);
		expect(rows("beten", weak)["Partizip II"]).toEqual(["gebetet"]);
		expect(rows("ernten", weak)["Partizip II"]).toEqual(["geerntet"]);
		expect(rows("übersetzen", weak)["Partizip II"]).toEqual(["übersetzt"]);
		expect(
			rows("übersetzen", { ...weak, separablePrefix: "über" })[
				"Partizip II"
			],
		).toEqual(["übergesetzt"]);
	});

	it("a Dat reflexive", () => {
		expect(
			rows("sich merken", {
				...weak,
				reflexive: "Dat",
			}).Imperativ,
		).toEqual(["merk dir!, merkt euch!, merken Sie sich!"]);
	});
});
