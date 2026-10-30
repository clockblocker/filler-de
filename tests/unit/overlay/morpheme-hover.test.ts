import { describe, expect, it } from "bun:test";
import { Text } from "@codemirror/state";
import { makeRecentTrace } from "@textfresser/vault-action-manager/diagnostics";
import { Exit, Layer, Scope } from "effect";
import {
	markMorphemes,
	morphemeMarks,
} from "../../../src/managers/overlay-manager/morpheme-hover/morpheme-hover";
import {
	inRenderedMorphemeSection,
	MORPHEMES_LINE_HOOK,
	morphemeSectionLines,
	morphemesOf,
	plainPieces,
	withoutMorphemeSection,
} from "../../../src/managers/overlay-manager/morpheme-hover/morphemes-line";
import { unitPartsAt } from "../../../src/managers/overlay-manager/unit-hover/unit-parts";
import { ObservabilityLive } from "../../../src/runtime/observability";
import { makePluginRuntime } from "../../../src/runtime/plugin-runtime";
import { fakeHost } from "../../support/obsidian-host";

const KOHLE = "Worter/de/Lexeme/NOUN/Fem/k/koh/kohle/Kohle";
const KRAFT = "Worter/de/Lexeme/NOUN/Fem/k/kra/kraft/Kraft";
const WERK = "Worter/w/wer/werk/werk";
const KRAFTWERK = "Worter/de/Lexeme/NOUN/Neut/k/kra/kraft/Kraftwerk";
const FAHREN = "Worter/de/Lexeme/VERB/f/fah/fahre/fahren";
const FADEN = "Worter/de/Lexeme/NOUN/Masc/f/fad/faden/Faden";
const VERLIEREN = "Worter/de/Lexeme/VERB/v/ver/verli/verlieren";

const title = (kind: string, text: string) =>
	`<span class="note_block_title note_block_title_${kind}">${text}</span>`;

const KOHLEKRAFTWERK = `${MORPHEMES_LINE_HOOK}[[${KOHLE}|Kohle]]|[[${KRAFT}|kraft]]|[[${WERK}|werk]]`;
const CONSTITUENTS = `[[${KOHLE}|Kohle]] + [[${KRAFTWERK}|Kraftwerk]]`;

/** What `line` shows of each of its morphemes. */
const shownOf = (line: string) =>
	morphemesOf(line).map(({ from, to }) => line.slice(from, to));

describe("morphemesOf", () => {
	it("splits the line on the pipes outside its links, never on an alias's", () => {
		expect(shownOf(KOHLEKRAFTWERK)).toEqual(["Kohle", "kraft", "werk"]);
	});

	it("finds unlinked letters and a link without an alias, and no Filler", () => {
		const line = `${MORPHEMES_LINE_HOOK}ge|[[${FAHREN}|fahr]]|en|-|[[${KRAFT}]]`;
		expect(shownOf(line)).toEqual(["ge", "fahr", "en", KRAFT]);
	});

	it("has no target for a zero ending, which shows no letters", () => {
		// The codec leaves a zero ending out; an empty piece is no target.
		const line = `${MORPHEMES_LINE_HOOK}[[${KOHLE}|Kohle]]||[[${WERK}|werk]]|`;
		expect(shownOf(line)).toEqual(["Kohle", "werk"]);
	});

	it("finds nothing on a line without the hook, such as a Locution's wording", () => {
		expect(morphemesOf(CONSTITUENTS)).toEqual([]);
		expect(
			morphemesOf(`[[${FADEN}|den Faden]] · [[${VERLIEREN}|verlieren]]`),
		).toEqual([]);
	});
});

describe("morphemeMarks", () => {
	const content = [
		title("morpheme", "Morpheme"),
		`${MORPHEMES_LINE_HOOK}ge|[[${FAHREN}|fahr]]|en`,
		CONSTITUENTS,
		"",
		KOHLEKRAFTWERK,
	].join("\n");
	const doc = Text.of(content.split("\n"));

	/** The text each mark of `ranges` covers. */
	const marked = (ranges: readonly { from: number; to: number }[]) => {
		const texts: string[] = [];
		morphemeMarks(doc, ranges).between(0, doc.length, (from, to) => {
			texts.push(content.slice(from, to));
		});
		return texts;
	};

	it("marks the visible text of every morpheme in the drawn ranges", () => {
		expect(marked([{ from: 0, to: doc.length }])).toEqual([
			"ge",
			"fahr",
			"en",
			"Kohle",
			"kraft",
			"werk",
		]);
	});

	it("marks only the lines the ranges touch, each once", () => {
		const second = content.indexOf(KOHLEKRAFTWERK);
		expect(marked([{ from: second, to: doc.length }])).toEqual([
			"Kohle",
			"kraft",
			"werk",
		]);
		// Two ranges in one line mark it once.
		const first = content.indexOf(MORPHEMES_LINE_HOOK);
		expect(
			marked([
				{ from: first, to: first + 2 },
				{ from: first + 5, to: first + 9 },
			]),
		).toEqual(["ge", "fahr", "en"]);
	});
});

describe("morphemeSectionLines", () => {
	it("holds the lines from the Morpheme title to the next title", () => {
		const lines = [
			title("synonyme", "Semantische Beziehungen"),
			`= [[${KRAFTWERK}|Kraftwerk]]`,
			title("morpheme", "Morpheme"),
			KOHLEKRAFTWERK,
			CONSTITUENTS,
			title("translations", "Übersetzung"),
			"coal-fired power plant",
		];
		expect(morphemeSectionLines(lines)).toEqual([
			false,
			false,
			true,
			true,
			true,
			false,
			false,
		]);
	});

	it("holds a Locution's wording, which has no morphemes line", () => {
		const lines = [
			title("morpheme", "Morpheme"),
			`[[${FADEN}|den Faden]] · [[${VERLIEREN}|verlieren]]`,
			title("translations", "Übersetzung"),
		];
		expect(morphemeSectionLines(lines)).toEqual([true, true, false]);
	});

	it("starts at the morphemes line when the title is empty", () => {
		expect(
			morphemeSectionLines([
				`= [[${KRAFTWERK}|Kraftwerk]]`,
				KOHLEKRAFTWERK,
				CONSTITUENTS,
				title("tags", "Tags"),
			]),
		).toEqual([false, true, true, false]);
	});

	it("blanks the section out with its offsets kept", () => {
		const text = [
			`= [[${KOHLE}|Kohle]]`,
			title("morpheme", "Morpheme"),
			KOHLEKRAFTWERK,
		].join("\n");
		const blanked = withoutMorphemeSection(text);
		expect(blanked).toHaveLength(text.length);
		expect(blanked.split("\n")[0]).toBe(`= [[${KOHLE}|Kohle]]`);
		expect(blanked.split("\n").slice(1).join("").trim()).toBe("");
	});
});

describe("the unit hover skips the Morpheme section", () => {
	const paragraph = [
		title("synonyme", "Semantische Beziehungen"),
		`= [[${KRAFTWERK}|Kraftwerk]], [[${KOHLE}|Kohle]]`,
		title("morpheme", "Morpheme"),
		KOHLEKRAFTWERK,
		CONSTITUENTS,
		title("translations", "Übersetzung"),
	].join("\n");

	it("finds no unit for a link of the morphemes or constituents line", () => {
		const morphemes = paragraph.indexOf(KOHLEKRAFTWERK);
		expect(
			unitPartsAt(paragraph, paragraph.indexOf("|kraft]]", morphemes)),
		).toEqual([]);
		expect(
			unitPartsAt(paragraph, paragraph.indexOf("Kohle]]", morphemes)),
		).toEqual([]);
		expect(
			unitPartsAt(paragraph, paragraph.indexOf(`${KRAFTWERK}|Kraftwerk]],`)),
		).not.toEqual([]);
		expect(
			unitPartsAt(
				paragraph,
				paragraph.indexOf("Kraftwerk]]", paragraph.indexOf(CONSTITUENTS)),
			),
		).toEqual([]);
	});

	it("leaves the section's links out of another line's unit", () => {
		const parts = unitPartsAt(paragraph, paragraph.indexOf("|Kohle]]\n") + 1);
		expect(parts.map(({ from, to }) => paragraph.slice(from, to))).toEqual([
			"Kohle",
		]);
	});
});

describe("plainPieces", () => {
	it("splits a rendered text node into morphemes and what is between", () => {
		expect(plainPieces("|ge|")).toEqual({
			pieces: [
				{ morpheme: false, text: "|" },
				{ morpheme: true, text: "ge" },
				{ morpheme: false, text: "|" },
			],
			rest: null,
		});
		expect(plainPieces("|-|").pieces.some(({ morpheme }) => morpheme)).toBe(
			false,
		);
	});

	it("stops at the line's end", () => {
		expect(plainPieces("|en\n")).toEqual({
			pieces: [
				{ morpheme: false, text: "|" },
				{ morpheme: true, text: "en" },
			],
			rest: "\n",
		});
	});
});

/** Just enough of a rendered node for the section walk. */
type FakeNode = {
	nodeType: number;
	parentNode: FakeNode | null;
	previousSibling: FakeNode | null;
	classList: { contains: (name: string) => boolean };
};

/** A block of `children`, each an element with its classes or a text node. */
function renderedBlock(children: readonly (string | null)[]) {
	const block: FakeNode = {
		classList: { contains: () => false },
		nodeType: 1,
		parentNode: null,
		previousSibling: null,
	};
	let previous: FakeNode | null = null;
	const nodes = children.map((classes) => {
		const names = (classes ?? "").split(" ");
		const node: FakeNode = {
			classList: { contains: (name) => names.includes(name) },
			nodeType: classes === null ? 3 : 1,
			parentNode: block,
			previousSibling: previous,
		};
		previous = node;
		return node;
	});
	const inSection = (at: number) =>
		inRenderedMorphemeSection(
			nodes[at] as unknown as Node,
			block as unknown as Node,
		);
	return { inSection };
}

describe("inRenderedMorphemeSection", () => {
	it("reads a rendered block's lines as the text's", () => {
		const { inSection } = renderedBlock([
			"note_block_title note_block_title_synonyme",
			"internal-link",
			"note_block_title note_block_title_morpheme",
			"tf-morphemes",
			"internal-link",
			null,
			"internal-link",
			"note_block_title note_block_title_translations",
			"internal-link",
		]);
		expect([1, 4, 6, 8].map(inSection)).toEqual([false, true, true, false]);
	});
});

describe("markMorphemes", () => {
	it("holds its editor extension and post-processor only while its scope is open", async () => {
		const { layer, obsidian } = fakeHost();
		const runtime = makePluginRuntime(
			layer.pipe(
				Layer.provideMerge(ObservabilityLive(makeRecentTrace())),
			),
			{
				onBuildFailed: () => {
					throw new Error("the host did not build");
				},
			},
		);
		const scope = Scope.makeUnsafe();
		await runtime.e2e("mark", Scope.provide(scope)(markMorphemes));
		expect(obsidian.registeredExtensions).toEqual([[expect.anything()]]);
		expect(obsidian.postProcessors).toHaveLength(1);
		let queried = 0;
		const section = {
			querySelectorAll: () => {
				queried++;
				return [];
			},
		};
		obsidian.postProcess(section);
		expect(queried).toBe(1);

		await runtime.e2e("close", Scope.close(scope, Exit.void));
		expect(obsidian.registeredExtensions).toEqual([[]]);
		obsidian.postProcess(section);
		expect(queried).toBe(1);
		await runtime.dispose();
	});
});
