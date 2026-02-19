import { describe, expect, it } from "bun:test";
import {
	parsePropagationNote,
	serializePropagationNote,
} from "../../../../../src/commanders/textfresser/domain/propagation";
import type { MorphologySectionDto } from "../../../../../src/commanders/textfresser/domain/propagation/types";

type MorphologyCorpusFixture = {
	name: string;
	note: string;
	expected: MorphologySectionDto;
};

function normalizeMorphologyPayload(
	payload: MorphologySectionDto,
): MorphologySectionDto {
	const backlinks = [...payload.backlinks].sort((left, right) => {
		const leftKey = `${left.relationType}|${left.value}`;
		const rightKey = `${right.relationType}|${right.value}`;
		return leftKey.localeCompare(rightKey);
	});
	const equations = [...payload.equations].sort((left, right) => {
		const leftKey = `${left.lhsParts.join("+")}=${left.rhs}`;
		const rightKey = `${right.lhsParts.join("+")}=${right.rhs}`;
		return leftKey.localeCompare(rightKey);
	});
	return {
		backlinks,
		equations,
		kind: "Morphology",
	};
}

function getMorphologyPayload(note: string): MorphologySectionDto {
	const entries = parsePropagationNote(note);
	const entry = entries[0];
	if (!entry) {
		throw new Error("Expected at least one parsed entry");
	}
	const section = entry.sections.find(
		(candidate): candidate is Extract<typeof entry.sections[number], { kind: "Morphology" }> =>
			candidate.kind === "Morphology",
	);
	if (!section) {
		throw new Error("Expected morphology section");
	}
	return section.payload;
}

const MORPHOLOGY_CORPUS: MorphologyCorpusFixture[] = [
	{
		expected: {
			backlinks: [
				{
					relationType: "derived_from",
					value: "[[wurzel]]",
				},
				{
					relationType: "compounded_from",
					value: "[[baum]]",
				},
				{
					relationType: "compounded_from",
					value: "[[haus]]",
				},
				{
					relationType: "used_in",
					value: "[[waldbauhaus]]",
				},
			],
			equations: [
				{
					lhsParts: ["baum", "haus"],
					rhs: "baumhaus",
				},
			],
			kind: "Morphology",
		},
		name: "mixed markers with equation and gloss text",
		note: [
			"🌲 Waldhaus ^m-1",
			"",
			'<span class="entry_section_title entry_section_title_morphologie">Morphologische Relationen</span>',
			"<derived_from>",
			"[[wurzel]] *(root gloss)*",
			"<consists_of>",
			"[[baum]] + [[haus]]",
			"[[baum]] + [[haus]] = [[baumhaus]] *(composite gloss)*",
			"<used_in>",
			"[[waldbauhaus]]",
		].join("\n"),
	},
	{
		expected: {
			backlinks: [
				{
					relationType: "derived_from",
					value: "[[ok]]",
				},
				{
					relationType: "used_in",
					value: "[[target#^1|t]]",
				},
				{
					relationType: "used_in",
					value: "[[sauber]]",
				},
			],
			equations: [],
			kind: "Morphology",
		},
		name: "malformed backlink lines are skipped while valid preserved links survive",
		note: [
			"🧪 Probe ^m-2",
			"",
			'<span class="entry_section_title entry_section_title_morphologie">Morphologische Relationen</span>',
			"<derived_from>",
			"this line has no links",
			"[[ok]]",
			"<used_in>",
			"![[embed-only]]",
			"[[target#^1|t]]",
			"[[sauber]]",
		].join("\n"),
	},
	{
		expected: {
			backlinks: [],
			equations: [
				{
					lhsParts: ["[[ab#^1|ab]]", "fahren"],
					rhs: "abfahren",
				},
			],
			kind: "Morphology",
		},
		name: "equations keep preserved exotic lhs tokens and do not become backlinks",
		note: [
			"🚂 abfahren ^m-3",
			"",
			'<span class="entry_section_title entry_section_title_morphologie">Morphologische Relationen</span>',
			"<consists_of>",
			"[[ab#^1|ab]] + [[fahren]] = [[abfahren]] *(to depart)*",
		].join("\n"),
	},
];

describe("propagation-v2 morphology corpus", () => {
	it("matches expected parse semantics for mixed and malformed morphology fixtures", () => {
		for (const fixture of MORPHOLOGY_CORPUS) {
			const parsed = getMorphologyPayload(fixture.note);
			expect(parsed).toEqual(fixture.expected);
		}
	});

	it("round-trips corpus fixtures without equation/backlink reclassification", () => {
		for (const fixture of MORPHOLOGY_CORPUS) {
			const firstParse = parsePropagationNote(fixture.note);
			const serialized = serializePropagationNote(firstParse);
			const secondParse = parsePropagationNote(serialized.body);

			const firstEntry = firstParse[0];
			const secondEntry = secondParse[0];
			if (!firstEntry || !secondEntry) {
				throw new Error("Expected roundtrip entries");
			}
			const firstMorph = firstEntry.sections.find(
				(candidate): candidate is Extract<typeof firstEntry.sections[number], { kind: "Morphology" }> =>
					candidate.kind === "Morphology",
			);
			const secondMorph = secondEntry.sections.find(
				(candidate): candidate is Extract<typeof secondEntry.sections[number], { kind: "Morphology" }> =>
					candidate.kind === "Morphology",
			);

			expect(firstMorph?.kind).toBe("Morphology");
			expect(secondMorph?.kind).toBe("Morphology");
			if (!firstMorph || !secondMorph) {
				return;
			}
			expect(normalizeMorphologyPayload(secondMorph.payload)).toEqual(
				normalizeMorphologyPayload(firstMorph.payload),
			);
		}
	});
});
