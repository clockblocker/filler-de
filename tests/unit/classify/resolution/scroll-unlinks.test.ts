import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import type { KeyedOccurrence } from "../../../../src/commanders/classify/resolution/occurrence-keys";
import {
	attestationRefOf,
	occurrenceKeyOf,
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
		readonly keys?: ReadonlyMap<number, KeyedOccurrence | undefined>;
	} = {},
) =>
	unlinkedOccurrences({
		content,
		links: linksIn(content, options.missing),
		recorded,
		...(options.keys ? { keys: options.keys } : {}),
	});

/** A link's occurrence keyed `occurrence`, in a Sentence of its own. */
const keyed = (occurrence: string): KeyedOccurrence => ({
	instance: 0,
	occurrence,
	occurrenceSentenceKey: `sentence of ${occurrence}`,
	segments: [0],
	sentenceKey: `sentence of ${occurrence}`,
});

/**
 * Judges as the observer does: once, then again with the keys of the links
 * it asked for, each the key `keyOf` gives its shown text's start, in the
 * order the links stand; undefined for one whose key cannot be computed.
 */
const settle = (
	content: string,
	recorded: readonly RecordedOccurrence[],
	keyOf: readonly (KeyedOccurrence | string | undefined)[],
) => {
	const first = judge(content, recorded);
	if (first.unkeyed.length === 0) return first;
	const links = linksIn(content);
	const keys = new Map(
		first.unkeyed.map((link) => {
			const key = keyOf[links.findIndex((l) => linkKeyOf(l) === linkKeyOf(link))];
			return [linkKeyOf(link), typeof key === "string" ? keyed(key) : key] as const;
		}),
	);
	return judge(content, recorded, { keys });
};

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
	const teich = `[[${TEICH}|Teich]]`;

	it("unlinks every occurrence of a Reading the Scroll no longer links, with no key, and nothing in a block that is gone", () => {
		const [first, second, cut] = [
			occurrence("0", "aaaaaaaa"),
			occurrence("1", "bbbbbbbb"),
			occurrence("2", "cccccccc"),
		];
		const content = `Der See ist tief. ^0\n\nDer See ist kalt. ^1\n`;
		expect(judge(content, [first, second, cut])).toEqual({
			unkeyed: [],
			unlinked: [first.ref, second.ref],
		});
		// Another Reading's links never shield it.
		expect(judge(`Der ${teich}. ^0\n`, [first])).toEqual({
			unkeyed: [],
			unlinked: [first.ref],
		});
	});

	it("asks for the keys of a Reading's links before it judges that Reading", () => {
		const [linked, gone] = [occurrence("0", "aaaaaaaa"), occurrence("1", "bbbbbbbb")];
		const recorded = [linked, gone];
		const content = `Der ${link} ist tief. ^0\n\nDer See ist kalt. ^1\n`;
		const first = judge(content, recorded);
		expect(first.unlinked).toEqual([]);
		expect(first.unkeyed.map(({ shown }) => content.slice(shown.from, shown.to))).toEqual(["See"]);
		expect(settle(content, recorded, ["aaaaaaaa"])).toEqual({
			unkeyed: [],
			unlinked: [gone.ref],
		});
	});

	it("keeps an occurrence whose key a link carries, wherever the link stands", () => {
		const recorded = occurrence("0", "aaaaaaaa");
		for (const content of [
			`Der ${link}. ^0\n`,
			`Neu. ^0\n\nDer ${link}. ^1\n`,
			`Neu. ^0\n\nDer ${link}.\n`,
		])
			expect(settle(content, [recorded], ["aaaaaaaa"]).unlinked).toEqual([]);
	});

	it("unclicked links: one whose key is recorded nowhere explains nothing, wherever it stands", () => {
		const recorded = occurrence("0", "aaaaaaaa");
		for (const content of [
			`Der See und der ${link}. ^0\n`,
			`Der See. ^0\n\nDer ${link}. ^1\n`,
			`Der See. ^0\n\nDer ${link}.\n`,
		])
			expect(settle(content, [recorded], ["ffffffff"])).toEqual({
				unkeyed: [],
				unlinked: [recorded.ref],
			});
		// An unclicked link beside the clicked one leaves it linked.
		expect(
			settle(`Der ${link} und der ${link}. ^0\n`, [recorded], ["ffffffff", "aaaaaaaa"])
				.unlinked,
		).toEqual([]);
	});

	it("a link whose key cannot be computed explains its block's occurrences, or every one when its block records none", () => {
		const [here, there] = [occurrence("0", "aaaaaaaa"), occurrence("1", "bbbbbbbb")];
		expect(
			settle(`Der ${link}. ^0\n\nDer See. ^1\n`, [here, there], [undefined]).unlinked,
		).toEqual([there.ref]);
		for (const content of [
			`Der See. ^0\n\nDer See. ^1\n\nDer ${link}. ^2\n`,
			`Der See. ^0\n\nDer See. ^1\n\nDer ${link}.\n`,
		])
			expect(settle(content, [here, there], [undefined]).unlinked).toEqual([]);
	});

	it("leaves a block alone that links a note which is not there", () => {
		const recorded = occurrence("0", "aaaaaaaa");
		const moved = `[[${SEE.replace("/s/see/", "/x/see/")}|See]]`;
		const content = `Der ${moved} ist tief. ^0\n`;
		expect(
			judge(content, [recorded], {
				missing: [SEE.replace("/s/see/", "/x/see/")],
			}),
		).toEqual({ unkeyed: [], unlinked: [] });
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
		expect(settle(content, recorded, ["aaaaaaaa"])).toEqual({
			unkeyed: [],
			unlinked: [unlinkedOne.ref],
		});
		// An unclicked link settles both; one with no key, neither.
		expect(settle(content, recorded, ["ffffffff"]).unlinked).toEqual([
			linkedOne.ref,
			unlinkedOne.ref,
		]);
		expect(settle(content, recorded, [undefined]).unlinked).toEqual([]);
	});

	describe("a repeated Sentence", () => {
		// "Der See." keyed at its first and second instance.
		const at = (instance: number): KeyedOccurrence => ({
			instance,
			occurrence: occurrenceKeyOf(
				{ occurrenceSentenceKey: "s", segments: [2] },
				instance,
			),
			occurrenceSentenceKey: "s",
			segments: [2],
			sentenceKey: "s",
		});
		const [k0, k1] = [at(0).occurrence, at(1).occurrence];

		it("keeps the copy left in its block when an earlier copy is deleted from another", () => {
			// ^0 and ^1 each held a copy; ^0's is deleted, ^0 keeps other
			// text, and ^1's copy becomes the first instance.
			const [first, second] = [occurrence("0", k0), occurrence("1", k1)];
			expect(
				settle(`Anderes. ^0\n\nDer ${link}. ^1\n`, [first, second], [at(0)]),
			).toEqual({ unkeyed: [], unlinked: [first.ref] });
		});

		it("tells two copies in one block apart by their own instances", () => {
			const [first, second] = [occurrence("0", k0), occurrence("0", k1)];
			expect(
				settle(`Der ${link}. Der See. ^0\n`, [first, second], [at(0)]).unlinked,
			).toEqual([second.ref]);
		});

		it("keeps an occurrence whose copy moved to a block without an ID, or one that records none, at another instance", () => {
			// ^3 recorded the second copy; the first was deleted, and the
			// paragraph was split, leaving the link outside ^3.
			const recorded = occurrence("3", k1);
			for (const content of [
				`Rest. ^3\n\nDer ${link}.\n`,
				`Rest. ^3\n\nDer ${link}. ^4\n`,
			])
				expect(settle(content, [recorded], [at(0)]).unlinked).toEqual([]);
			// A block that records another occurrence of the Reading claims its
			// link for that one.
			const other = occurrence("4", "eeeeeeee");
			expect(
				settle(`Rest. ^3\n\nDer ${link}. ^4\n`, [recorded, other], [at(0)])
					.unlinked,
			).toEqual([recorded.ref, other.ref]);
		});
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
	/**
	 * The reopener over notes whose Knowledge runs until the test lands it,
	 * and an active note the test moves; `leaves` ends once it moves off.
	 */
	function reopenerOver(initial: string | null) {
		const running = new Map<string, () => void>();
		const refreshed: string[] = [];
		let active = initial;
		const moved: (() => void)[] = [];
		const reopenEffect = createReadingReopener({
			activePath: Effect.sync(() => active),
			leaves: (path) =>
				Effect.callback<void>((resume) => {
					if (active !== path) return resume(Effect.void);
					moved.push(() => {
						if (active !== path) resume(Effect.void);
					});
				}),
			queue: {
				awaitNote: (path) =>
					Effect.callback<boolean>((resume) => {
						running.set(path, () => resume(Effect.succeed(true)));
					}),
			},
			refresh: (path) =>
				Effect.sync(() => {
					refreshed.push(path);
				}),
		});
		return {
			land: (path: string) => running.get(path)?.(),
			navigate: (to: string | null) => {
				active = to;
				for (const tell of moved.splice(0)) tell();
			},
			refreshed,
			reopen: (target: string) => Effect.runPromise(reopenEffect(target)),
		};
	}

	it("shows the Knowledge in the clicked note, in place, while it is still the active one", async () => {
		const { land, refreshed, reopen } = reopenerOver(`${SEE}.md`);
		const see = reopen(`${SEE}|See`);
		land(SEE);
		expect(await see).toBe(true);
		expect(refreshed).toEqual([`${SEE}.md`]);
	});

	it("does nothing once the user navigated away, and stops waiting then", async () => {
		const { land, navigate, refreshed, reopen } = reopenerOver(`${SEE}.md`);
		const see = reopen(`${SEE}|See`);
		// Back to the Scroll before the Knowledge lands: the wait ends now.
		navigate("Library/Story.md");
		expect(await see).toBe(false);
		land(SEE);
		expect(refreshed).toEqual([]);
	});

	it("does nothing for a note that is not the active one, nor for an older click", async () => {
		const { land, navigate, refreshed, reopen } = reopenerOver(`${SEE}.md`);
		const see = reopen(`${SEE}|See`);
		navigate(`${TEICH}.md`);
		const teich = reopen(`${TEICH}|Teich`);
		land(SEE);
		land(TEICH);
		expect(await see).toBe(false);
		expect(await teich).toBe(true);
		expect(refreshed).toEqual([`${TEICH}.md`]);
		expect(await reopen("Library/Other|Other")).toBe(false);
	});
});
