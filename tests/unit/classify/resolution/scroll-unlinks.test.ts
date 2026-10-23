import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import {
	attestationRefOf,
	parseAttestationRef,
} from "../../../../src/commanders/classify/resolution/scroll-links";
import { createReadingReopener } from "../../../../src/commanders/classify/resolution/scroll-to-reading";
import {
	linkKeyOf,
	linksOneOf,
	type RecordedOccurrence,
	type ScrollLink,
	scrollLinksOf,
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

/** The Scroll's links, resolved as their full path names a note unless it is `missing`. */
const linksIn = (content: string, missing: readonly string[] = []): ScrollLink[] =>
	scrollLinksOf(content).map(({ block, linkpath, shown }) => ({
		block,
		notePath: missing.includes(linkpath) ? undefined : `${linkpath}.md`,
		shown,
	}));

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
		links: linksIn(content, options.missing),
		recorded,
		...(options.keys ? { keys: options.keys } : {}),
	});

describe("scrollLinksOf", () => {
	it("reads every wikilink and embed with its path and block, outside code and comments", () => {
		const content = [
			"---",
			`a: "[[${SEE}|See]]"`,
			"---",
			`Der [[${SEE}|See]] und [[${TEICH}#^r-1|Teich]] und ![[${SEE}]] und [[Meer]]. ^0`,
			"",
			`| [[ 🌊 See \\|See]] | [[#Kopf]] |`,
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
			scrollLinksOf(content).map(({ block, linkpath, shown }) => ({
				block,
				linkpath,
				shown: content.slice(shown.from, shown.to),
			})),
		).toEqual([
			{ block: "0", linkpath: SEE, shown: "See" },
			{ block: "0", linkpath: TEICH, shown: "Teich" },
			{ block: "0", linkpath: SEE, shown: SEE },
			{ block: "0", linkpath: "Meer", shown: "Meer" },
			{ block: undefined, linkpath: "🌊 See", shown: "See" },
			{ block: undefined, linkpath: "", shown: "#Kopf" },
			{ block: undefined, linkpath: SEE, shown: SEE },
		]);
	});
});

describe("linksOneOf", () => {
	it("tells whether the Scroll links a recorded occurrence in its block", () => {
		const recorded = [occurrence("0", "aaaaaaaa")];
		expect(linksOneOf(linksIn(`Der [[${SEE}|See]]. ^0\n`), recorded)).toBe(true);
		// Its Reading in another block, another Reading in its block, or a
		// link in flux prove nothing.
		expect(linksOneOf(linksIn(`Neu. ^0\n\nDer [[${SEE}|See]]. ^1\n`), recorded)).toBe(false);
		expect(linksOneOf(linksIn(`Der [[${TEICH}|Teich]]. ^0\n`), recorded)).toBe(false);
		expect(linksOneOf(linksIn(`Der [[${SEE}|See]]. ^0\n`, [SEE]), recorded)).toBe(false);
	});
});

describe("unlinkedOccurrences", () => {
	const link = `[[${SEE}|See]]`;

	it("unlinks what a block no longer links, and nothing in a block that is gone", () => {
		const [kept, gone, cut] = [
			occurrence("0", "aaaaaaaa"),
			occurrence("1", "bbbbbbbb"),
			occurrence("2", "cccccccc"),
		];
		const content = `Der ${link} ist tief. ^0\n\nDer See ist kalt. ^1\n`;
		expect(judge(content, [kept, gone, cut])).toEqual({
			unkeyed: [],
			unlinked: [gone.ref],
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
				missing: [SEE.replace("/s/see/", "/x/see/")],
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
			linkpath: "Story-Library",
			occurrence: "1a2b3c4d",
		});
		expect(parseAttestationRef("![[Story#^4|^]]")).toBeUndefined();
	});
});

describe("createReadingReopener", () => {
	it("reopens the latest clicked Reading note once its Knowledge lands, unless it is open", async () => {
		const running = new Map<string, () => void>();
		const opened: string[] = [];
		let active: string | null = "Library/Story.md";
		const reopenEffect = createReadingReopener({
			activePath: Effect.sync(() => active),
			open: (path) =>
				Effect.sync(() => {
					opened.push(path);
				}),
			queue: {
				awaitNote: (path) =>
					new Promise<boolean>((resolve) => {
						running.set(path, () => resolve(true));
					}),
			},
		});
		const reopen = (target: string) => Effect.runPromise(reopenEffect(target));
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
