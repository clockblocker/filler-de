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
		...options,
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

/**
 * The principal parts texteater#1218 stores, as dumcorpus's gold records
 * hold them (der Zug fährt gleich ab, der Elefant trompetete, der Kellner
 * bringt eine Cola, von morgen an fahre ich mit dem Rad zur Arbeit).
 */
describe("verbs with stored principal parts (texteater#1218)", () => {
	const fahren = {
		conjugationClasses: ["Strong"],
		pastParticiple: ["gefahren"],
		presentSingular: {
			first: ["fahre"],
			second: ["fährst"],
			third: ["fährt"],
		},
		preterite: ["fuhr"],
		subjunctivePast: ["führe"],
	} as const;

	it("fahren gets every row but the Imperativ", () => {
		expect(rows("fahren", fahren)).toEqual({
			"Konjunktiv II": [
				"ich führe, du führest, er führe, wir führen, ihr führet, sie führen",
			],
			"Partizip II": ["gefahren"],
			Präsens: [
				"ich fahre, du fährst, er fährt, wir fahren, ihr fahrt, sie fahren",
			],
			Präteritum: [
				"ich fuhr, du fuhrst, er fuhr, wir fuhren, ihr fuhrt, sie fuhren",
			],
		});
	});

	it("renders fahren through the inflection hook", () => {
		expect(
			deriveInflection(
				input(verb("fahren"), {
					conjugationClass: ["Strong"],
					pastParticiple: ["gefahren"],
					presentSingular: {
						first: ["fahre"],
						second: ["fährst"],
						third: ["fährt"],
					},
					preterite: ["fuhr"],
					subjunctivePast: ["führe"],
				}),
			),
		).toBe(`Präsens: ich fahre, du fährst, er fährt, wir fahren, ihr fahrt, sie fahren
Präteritum: ich fuhr, du fuhrst, er fuhr, wir fuhren, ihr fuhrt, sie fuhren
Konjunktiv II: ich führe, du führest, er führe, wir führen, ihr führet, sie führen
Partizip II: gefahren`);
	});

	it("abfahren places its particle in the finite forms only", () => {
		expect(
			rows("abfahren", {
				conjugationClasses: ["Strong"],
				pastParticiple: ["abgefahren"],
				presentSingular: {
					first: ["fahre ab"],
					second: ["fährst ab"],
					third: ["fährt ab"],
				},
				preterite: ["fuhr ab"],
				separablePrefix: "ab",
				subjunctivePast: ["führe ab"],
			}),
		).toEqual({
			"Konjunktiv II": [
				"ich führe ab, du führest ab, er führe ab, wir führen ab, ihr führet ab, sie führen ab",
			],
			"Partizip II": ["abgefahren"],
			Präsens: [
				"ich fahre ab, du fährst ab, er fährt ab, wir fahren ab, ihr fahrt ab, sie fahren ab",
			],
			Präteritum: [
				"ich fuhr ab, du fuhrst ab, er fuhr ab, wir fuhren ab, ihr fuhrt ab, sie fuhren ab",
			],
		});
	});

	it("bringen gets its umlauted Konjunktiv II from the stored form", () => {
		expect(
			rows("bringen", {
				conjugationClasses: ["Mixed"],
				pastParticiple: ["gebracht"],
				presentSingular: {
					first: ["bringe"],
					second: ["bringst"],
					third: ["bringt"],
				},
				preterite: ["brachte"],
				subjunctivePast: ["brächte"],
			}),
		).toEqual({
			"Konjunktiv II": [
				"ich brächte, du brächtest, er brächte, wir brächten, ihr brächtet, sie brächten",
			],
			"Partizip II": ["gebracht"],
			Präsens: [
				"ich bringe, du bringst, er bringt, wir bringen, ihr bringt, sie bringen",
			],
			Präteritum: [
				"ich brachte, du brachtest, er brachte, wir brachten, ihr brachtet, sie brachten",
			],
		});
	});

	it("trompeten gets the Partizip II no rule could give it", () => {
		const past =
			"ich trompetete, du trompetetest, er trompetete, wir trompeteten, ihr trompetetet, sie trompeteten";
		expect(
			rows("trompeten", {
				conjugationClasses: ["Weak"],
				pastParticiple: ["trompetet"],
				presentSingular: {
					first: ["trompete"],
					second: ["trompetest"],
					third: ["trompetet"],
				},
				preterite: ["trompetete"],
				subjunctivePast: ["trompetete"],
			}),
		).toEqual({
			Imperativ: ["trompete!, trompetet!, trompeten Sie!"],
			"Konjunktiv II": [past],
			"Partizip II": ["trompetet"],
			Präsens: [
				"ich trompete, du trompetest, er trompetet, wir trompeten, ihr trompetet, sie trompeten",
			],
			Präteritum: [past],
		});
		expect(
			rows("trompeten", { ...weak, pastParticiple: ["trompetet"] })[
				"Partizip II"
			],
		).toEqual(["trompetet"]);
	});

	it("each stored aspect fills only its own cells", () => {
		expect(
			rows("fahren", {
				conjugationClasses: ["Strong"],
				pastParticiple: ["gefahren"],
			}),
		).toEqual({
			"Partizip II": ["gefahren"],
			Präsens: ["ich fahre, wir fahren, ihr fahrt, sie fahren"],
		});
	});

	it("stored forms win over a weak verb's rules", () => {
		const table = rows("senden", {
			conjugationClasses: ["Weak"],
			pastParticiple: ["gesendet"],
			subjunctivePast: ["sendete"],
		});
		expect(table["Partizip II"]).toEqual(["gesendet"]);
		expect(table["Konjunktiv II"]).toEqual([
			"ich sendete, du sendetest, er sendete, wir sendeten, ihr sendetet, sie sendeten",
		]);
	});

	it("lists each stored alternative", () => {
		expect(
			rows("backen", {
				conjugationClasses: ["Weak"],
				pastParticiple: ["gebacken"],
				presentSingular: {
					first: ["backe"],
					second: ["backst", "bäckst"],
					third: ["backt", "bäckt"],
				},
				preterite: ["backte"],
			}),
		).toMatchObject({
			"Partizip II": ["gebacken"],
			Präsens: [
				"ich backe, du backst, du bäckst, er backt, er bäckt, wir backen, ihr backt, sie backen",
			],
		});
	});

	it("leaves out a stored form that does not fit the verb, never a rule's guess", () => {
		expect(
			rows("abfahren", {
				conjugationClasses: ["Strong"],
				// No particle in the participle, the wrong one in a Präsens form.
				pastParticiple: ["gefahren"],
				presentSingular: {
					first: ["fahre ab"],
					second: ["fährst an"],
					third: ["fährt ab"],
				},
				separablePrefix: "ab",
				// A Konjunktiv II form ends in -e.
				subjunctivePast: ["führ ab"],
			}),
		).toEqual({
			Präsens: [
				"ich fahre ab, er fährt ab, wir fahren ab, ihr fahrt ab, sie fahren ab",
			],
		});
	});

	it("places a reflexive in the stored finite forms", () => {
		expect(
			rows("sich erinnern", {
				conjugationClasses: ["Weak"],
				pastParticiple: ["erinnert"],
				presentSingular: {
					first: ["erinnere"],
					second: ["erinnerst"],
					third: ["erinnert"],
				},
				reflexive: "Acc",
				subjunctivePast: ["erinnerte"],
			}),
		).toMatchObject({
			"Konjunktiv II": [
				"ich erinnerte mich, du erinnertest dich, er erinnerte sich, wir erinnerten uns, ihr erinnertet euch, sie erinnerten sich",
			],
			"Partizip II": ["erinnert"],
			Präsens: [
				"ich erinnere mich, du erinnerst dich, er erinnert sich, wir erinnern uns, ihr erinnert euch, sie erinnern sich",
			],
		});
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

	it("renders studieren with no ge- in any cell", () => {
		const past =
			"ich studierte, du studiertest, er studierte, wir studierten, ihr studiertet, sie studierten";
		expect(rows("studieren", weak)).toEqual({
			Imperativ: ["studier!, studiert!, studieren Sie!"],
			"Konjunktiv II": [past],
			"Partizip II": ["studiert"],
			Präsens: [
				"ich studiere, du studierst, er studiert, wir studieren, ihr studiert, sie studieren",
			],
			Präteritum: [past],
		});
	});

	it("trompeten, whose first syllable is unstressed, gets no Partizip II", () => {
		const past =
			"ich trompetete, du trompetetest, er trompetete, wir trompeteten, ihr trompetetet, sie trompeteten";
		expect(rows("trompeten", weak)).toEqual({
			Imperativ: ["trompete!, trompetet!, trompeten Sie!"],
			"Konjunktiv II": [past],
			Präsens: [
				"ich trompete, du trompetest, er trompetet, wir trompeten, ihr trompetet, sie trompeten",
			],
			Präteritum: [past],
		});
	});

	it("any root longer than a syllable gets no Partizip II, its stress unknown", () => {
		// posaunt, frohlockt, miaut, prophezeit, rumort: no ge-;
		// gearbeitet, geantwortet: ge-. Only a dictionary tells them apart.
		for (const infinitive of [
			"posaunen",
			"frohlocken",
			"miauen",
			"prophezeien",
			"rumoren",
			"palavern",
			"arbeiten",
			"antworten",
		])
			expect(rows(infinitive, weak)["Partizip II"]).toBeUndefined();
		expect(
			rows("bringen", {
				conjugationClasses: ["Mixed"],
				preterite: ["brachte"],
			})["Partizip II"],
		).toEqual(["gebracht"]);
	});

	it("a one-syllable root before -eln, -ern or -ig carries the stress", () => {
		expect(rows("handeln", weak)["Partizip II"]).toEqual(["gehandelt"]);
		expect(rows("ärgern", weak)["Partizip II"]).toEqual(["geärgert"]);
		expect(rows("kündigen", weak)["Partizip II"]).toEqual(["gekündigt"]);
	});

	it("tells an -ern verb from an inseparable prefix", () => {
		expect(rows("entern", weak)["Partizip II"]).toEqual(["geentert"]);
		expect(rows("erinnern", weak)["Partizip II"]).toEqual(["erinnert"]);
		expect(rows("verbessern", weak)["Partizip II"]).toEqual(["verbessert"]);
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
