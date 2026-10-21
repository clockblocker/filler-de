import { describe, expect, it } from "bun:test";
import {
	attestationRefOf,
	parseAttestationRef,
} from "../../../../src/commanders/classify/resolution/scroll-links";
import { createReadingReopener } from "../../../../src/commanders/classify/resolution/scroll-to-reading";
import {
	dictionaryLinksOf,
	linkKeyOf,
	type RecordedOccurrence,
	unlinkedOccurrences,
} from "../../../../src/commanders/classify/resolution/scroll-unlinks";

const SEE = "Worter/de/Lexeme/NOUN/Masc/s/see/see/🌊 See";
const TEICH = "Worter/de/Lexeme/NOUN/Masc/t/tei/teich/🦆 Teich";

const occurrence = (
	blockId: string,
	key: string,
	readingPath = `${SEE}.md`,
): RecordedOccurrence => ({
	blockId,
	occurrence: key,
	readingPath,
	ref: attestationRefOf("Library/Story.md", blockId, key),
});

const judge = (
	content: string,
	recorded: readonly RecordedOccurrence[],
	options: {
		readonly missing?: readonly string[];
		readonly keys?: ReadonlyMap<number, string | undefined>;
	} = {},
) =>
	unlinkedOccurrences({
		content,
		isMissingNote: (path) => (options.missing ?? []).includes(path),
		links: dictionaryLinksOf(content),
		recorded,
		...(options.keys ? { keys: options.keys } : {}),
	});

describe("dictionaryLinksOf", () => {
	it("reads the links into Worter/ with their blocks, outside code and comments", () => {
		const content = [
			"---",
			`a: "[[${SEE}|See]]"`,
			"---",
			`Der [[${SEE}|See]] und [[${TEICH}#^r-1|Teich]] und ![[${SEE}]] und [[Meer]]. ^0`,
			"",
			`\`[[${SEE}|See]]\` %%[[${SEE}]]%%`,
			"",
			"```",
			`[[${SEE}|See]]`,
			"```",
			`Ohne ID [[${SEE}]].`,
			"",
		].join("\n");
		expect(
			dictionaryLinksOf(content).map(({ block, notePath, shown }) => ({
				block,
				notePath,
				shown: content.slice(shown.from, shown.to),
			})),
		).toEqual([
			{ block: "0", notePath: `${SEE}.md`, shown: "See" },
			{ block: "0", notePath: `${TEICH}.md`, shown: "Teich" },
			{ block: undefined, notePath: `${SEE}.md`, shown: SEE },
		]);
	});
});

describe("unlinkedOccurrences", () => {
	const link = `[[${SEE}|See]]`;

	it("unlinks what a block no longer links, also when the block is gone", () => {
		const [kept, gone, deleted] = [
			occurrence("0", "aaaaaaaa"),
			occurrence("1", "bbbbbbbb"),
			occurrence("2", "cccccccc"),
		];
		const content = `Der ${link} ist tief. ^0\n\nDer See ist kalt. ^1\n`;
		expect(judge(content, [kept, gone, deleted])).toEqual({
			unkeyed: [],
			unlinked: [gone.ref, deleted.ref],
		});
	});

	it("leaves a Reading alone whose link stands in another block or one without an ID", () => {
		const recorded = occurrence("0", "aaaaaaaa");
		expect(judge(`Neu. ^0\n\nDer ${link}. ^1\n`, [recorded]).unlinked).toEqual([]);
		expect(judge(`Neu. ^0\n\nDer ${link}.\n`, [recorded]).unlinked).toEqual([]);
		// Another Reading's links never shield it.
		const teich = `[[${TEICH}|Teich]]`;
		expect(judge(`Neu. ^0\n\nDer ${teich}. ^1\n`, [recorded]).unlinked).toEqual([
			recorded.ref,
		]);
	});

	it("leaves a block alone that links a note which is not there", () => {
		const recorded = occurrence("0", "aaaaaaaa");
		const moved = `[[${SEE.replace("/s/see/", "/x/see/")}|See]]`;
		const content = `Der ${moved} ist tief. ^0\n`;
		expect(
			judge(content, [recorded], {
				missing: [`${SEE.replace("/s/see/", "/x/see/")}.md`],
			}).unlinked,
		).toEqual([]);
		expect(judge(content, [recorded]).unlinked).toEqual([recorded.ref]);
	});

	it("unlinks nothing in a file that holds none of its refs' blocks", () => {
		expect(judge("Ein anderer Text. ^7\n", [occurrence("0", "aaaaaaaa")]).unlinked).toEqual([]);
	});

	it("settles several occurrences of one Reading in a block by their keys", () => {
		const linkedOne = occurrence("0", "aaaaaaaa");
		const unlinkedOne = occurrence("0", "bbbbbbbb");
		const recorded = [linkedOne, unlinkedOne];
		const content = `Der ${link} ist tief. Der See ist tief. ^0\n`;
		const first = judge(content, recorded);
		expect(first.unlinked).toEqual([]);
		expect(first.unkeyed).toHaveLength(1);
		const [remaining] = first.unkeyed;
		if (!remaining) throw new Error("no unkeyed link");
		const keyed = (key: string | undefined) =>
			judge(content, recorded, { keys: new Map([[linkKeyOf(remaining), key]]) });
		expect(keyed("aaaaaaaa")).toEqual({ unkeyed: [], unlinked: [unlinkedOne.ref] });
		// A key the block does not record, or none, settles nothing.
		expect(keyed("ffffffff").unlinked).toEqual([]);
		expect(keyed(undefined).unlinked).toEqual([]);
	});
});

describe("parseAttestationRef", () => {
	it("reads back what attestationRefOf writes, and nothing else", () => {
		expect(parseAttestationRef(attestationRefOf("Library/Story-Library.md", "4", "1a2b3c4d"))).toEqual({
			blockId: "4",
			occurrence: "1a2b3c4d",
			scrollBasename: "Story-Library",
		});
		expect(parseAttestationRef("![[Story#^4|^]]")).toBeUndefined();
	});
});

describe("createReadingReopener", () => {
	it("reopens the latest clicked Reading note once its Knowledge lands, unless it is open", async () => {
		const running = new Map<string, () => void>();
		const opened: string[] = [];
		let active: string | null = "Library/Story.md";
		const reopen = createReadingReopener({
			activePath: async () => active,
			open: async (path) => {
				opened.push(path);
			},
			queue: {
				awaitNote: (path) =>
					new Promise<boolean>((resolve) => {
						running.set(path, () => resolve(true));
					}),
			},
		});
		const see = reopen(`${SEE}|See`);
		const teich = reopen(`${TEICH}|Teich`);
		running.get(SEE)?.();
		running.get(TEICH)?.();
		expect(await see).toBe(false);
		expect(await teich).toBe(true);
		expect(opened).toEqual([`${TEICH}.md`]);

		active = `${SEE}.md`;
		const again = reopen(`${SEE}|See`);
		running.get(SEE)?.();
		expect(await again).toBe(false);
		expect(await reopen("Library/Other|Other")).toBe(false);
		expect(opened).toEqual([`${TEICH}.md`]);
	});
});
