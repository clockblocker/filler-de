import { describe, expect, it } from "bun:test";
import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import { applyParadigmChanges, paradigmChangesFor } from "dumrel";
import type * as Dumrel from "dumrel/types";
import { interimInflection, interimTags, principalPartsOf } from "../src";
import { noun, verb } from "./fixtures";

const readingOf = (lemma: Dumling.Lemma<"de">, emojiDescription: string) =>
	({ emojiDescription, lemma, unitKind: "Reading" }) as Dumling.Reading<"de">;

function paradigmOf(
	lemma: Dumling.Lemma<"de">,
	licences: readonly [Dumling.Reading<"de">, Dumrel.DimensionId, string[]][],
): Dumrel.LemmaParadigm {
	const result = applyParadigmChanges({
		changes: licences.flatMap(([reading, dimension, values]) =>
			paradigmChangesFor({
				dimension,
				provenance: "Produced",
				reading,
				values,
			}),
		),
		lemma,
		paradigm: { dimensions: {} },
		readings: [...new Set(licences.map(([reading]) => reading))],
	});
	if (!result.success) throw result.error;
	return result.value;
}

const records = (
	lemma: Dumling.Lemma<"de">,
	readings: readonly Dumling.Reading<"de">[],
	paradigm?: Dumrel.LemmaParadigm,
) => ({
	lemmaRecord: { lemma, ...(paradigm ? { paradigm } : {}) },
	ownedSurfaceEntries: [],
	readingEntries: readings.map((reading) => ({ reading })),
});

const bank = noun("Bank", "Fem");
const bench = readingOf(bank, "🪑");
const money = readingOf(bank, "🏦");
const bankParadigm = paradigmOf(bank, [
	[bench, "plural", ["Bänke"]],
	[money, "plural", ["Banken"]],
]);

describe("TODO(#120): the interim German hooks", () => {
	it("give each Licence Group the principal parts its variants hold", () => {
		const keyOf = (reading: Dumling.Reading<"de">) =>
			readingIdentityKey(reading);
		expect(
			principalPartsOf(bank, bankParadigm, {
				plural:
					bankParadigm.dimensions.plural?.licences[keyOf(bench)] ??
					[],
			}),
		).toEqual({ plural: ["Bänke"] });
		const geld = noun("Geld", "Neut");
		const none = readingOf(geld, "💶");
		const marker = paradigmOf(geld, [[none, "plural", ["NoPlural"]]]);
		expect(
			principalPartsOf(geld, marker, {
				plural:
					marker.dimensions.plural?.variants.map(({ id }) => id) ??
					[],
			}),
		).toEqual({ plural: "NoPlural" });
		expect(principalPartsOf(bank, undefined, {})).toBeUndefined();
	});

	it("render one table per Licence Group, from its own plural", () => {
		const rendered = interimInflection({
			records: records(bank, [bench, money], bankParadigm),
		});
		expect(rendered.tables).toHaveLength(2);
		const byEmoji = new Map(
			rendered.tables.map((table) => [
				(table.readings[0] as { emojiDescription: string })
					.emojiDescription,
				table.lines,
			]),
		);
		expect(byEmoji.get("🪑")).toContain("N: die Bank, die Bänke");
		expect(byEmoji.get("🏦")).toContain("N: die Bank, die Banken");
	});

	it("render one group with no table for a noun without a Paradigm", () => {
		const rendered = interimInflection({
			records: records(bank, [bench, money]),
		});
		expect(rendered.tables).toMatchObject([{ lines: [] }]);
	});

	it("tag a Reading with the conjugation class its own preterite gives", () => {
		const fahren = verb("fahren");
		const car = readingOf(fahren, "🚗");
		const paradigm = paradigmOf(fahren, [[car, "preterite", ["fuhr"]]]);
		expect(
			interimTags({
				entry: { reading: car },
				records: records(fahren, [car], paradigm),
			}),
		).toContain("verb/strong");
		const kaufen = verb("kaufen");
		const buy = readingOf(kaufen, "🛒");
		expect(
			interimTags({
				entry: { reading: buy },
				records: records(
					kaufen,
					[buy],
					paradigmOf(kaufen, [[buy, "preterite", ["kaufte"]]]),
				),
			}),
		).toContain("verb/weak");
	});
});
