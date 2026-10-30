import { describe, expect, it } from "bun:test";
import type * as Dumling from "dumling/types";
import { knowledgeRequestFor } from "../../../../src/commanders/classify/resolution/knowledge-request";
import {
	attestationRefOf,
	linkMinted,
	linkUnitsInScroll,
	mintBlockIds,
	sourceBlocksOf,
	withEdits,
} from "../../../../src/commanders/classify/resolution/scroll-links";
import { scrollSentences } from "../../../../src/commanders/classify/scroll-sentences";

const target = {
	readingPath: "Worter/de/Lexeme/NOUN/Masc/s/see/see/🌊 See.md",
};
const ref = { segments: [2], sentenceKey: "k" };
const LINK = "[[Worter/de/Lexeme/NOUN/Masc/s/see/see/🌊 See|See]]";

function at(content: string, text: string) {
	const from = content.indexOf(text);
	return { from, to: from + text.length };
}

describe("sourceBlocksOf", () => {
	it("finds a block's ID, or where one goes, and leaves tables and code alone", () => {
		const content =
			"Eins zwei. ^4\n\nDrei vier\nfünf.\n\n- sechs\n- sieben ^x\n\n| See | lake |\n\n```\nSee\n```\n";
		const blocks = sourceBlocksOf(content, [
			content.indexOf("zwei"),
			content.indexOf("Drei"),
			content.indexOf("fünf"),
			content.indexOf("sechs"),
			content.indexOf("sieben"),
			content.indexOf("See |"),
			content.lastIndexOf("See"),
		]);
		expect([...blocks.values()]).toEqual([
			{ _tag: "Identified", id: "4" },
			{ _tag: "Unidentified", mintAt: content.indexOf("fünf.") + 5 },
			{ _tag: "Unidentified", mintAt: content.indexOf("fünf.") + 5 },
			{ _tag: "Unidentified", mintAt: content.indexOf("sechs") + 5 },
			{ _tag: "Identified", id: "x" },
			{ _tag: "Unaddressable", reason: "inside a table" },
			{ _tag: "Unaddressable", reason: "inside a code block" },
		]);
		expect(attestationRefOf("Library/Story-Library.md", "4", "1a2b3c4d")).toBe(
			"![[Story-Library#^4|^1a2b3c4d]]",
		);
	});
});

describe("mintBlockIds", () => {
	it("numbers after the current content and appends at the paragraph's current end", () => {
		const snapshot = "Der See ist tief\n\nNext\n";
		// The user kept typing in the paragraph; another run minted ^3 elsewhere.
		const current = "Der See ist tief und kalt\n\nNext ^3\n";
		const minted = mintBlockIds({
			current,
			offsets: [snapshot.indexOf("\n")],
			snapshot,
		});
		expect(minted.content).toBe("Der See ist tief und kalt ^4\n\nNext ^3\n");
		expect([...minted.ids.values()]).toEqual(["4"]);
		expect(minted.edits).toEqual([]);
	});

	it("keeps an ID a block gained meanwhile", () => {
		const snapshot = "Der See ist tief.\n";
		const minted = mintBlockIds({
			current: "Der See ist tief. ^9\n",
			offsets: [snapshot.indexOf("\n")],
			snapshot,
		});
		expect(minted.content).toBe("Der See ist tief. ^9\n");
		expect([...minted.ids.values()]).toEqual(["9"]);
	});

	it("reports what it appended to the snapshot it saw, so links map past it", () => {
		const snapshot = "Der See ist tief.\n\nDie See ist rau.\n";
		const minted = mintBlockIds({
			current: snapshot,
			offsets: [snapshot.indexOf("\n"), snapshot.lastIndexOf("\n")],
			snapshot,
		});
		const moved = withEdits(snapshot, minted.edits);
		expect(moved.content).toBe(minted.content);
		const rau = at(snapshot, "rau");
		expect(moved.content.slice(moved.move(rau).from, moved.move(rau).to)).toBe(
			"rau",
		);
	});
});

describe("mintBlockIds after the user typed", () => {
	it("finds a block by its line, never by an offset another paragraph now holds", () => {
		for (const [snapshot, current] of [
			["A.\n\nDer See ist tief.\n", "A.\n\nNeu hier.\n\nDer See ist tief.\n"],
			["Der See ist tief.\n", "Der Hund.\n\nDer See ist tief.\n"],
		] as const) {
			const minted = mintBlockIds({
				current,
				offsets: [snapshot.indexOf("tief.") + 5],
				snapshot,
			});
			expect(minted.content).toBe(current.replace("tief.", "tief. ^0"));
		}
	});

	it("keeps links mappable on lines that gained an ID", () => {
		const snapshot = "Der Hund bellt.\n\nDie Katze schläft.\n\nDer See ist tief.\n";
		const current = `Notiz.\n\n${snapshot}`;
		const ends = [...snapshot.matchAll(/\.\n/gu)].map(({ index }) => index + 1);
		const minted = mintBlockIds({ current, offsets: ends, snapshot });
		const moved = withEdits(snapshot, minted.edits);
		const words = ["Hund", "Katze", "See"].map((word) => at(snapshot, word));
		const linked = linkUnitsInScroll({
			current: minted.content,
			edits: words.map((occurrence) => ({
				occurrences: [moved.move(occurrence)],
				ref,
				target,
			})),
			snapshot: moved.content,
		});
		expect(linked.linked).toEqual([1, 1, 1]);
		expect(linked.content).toContain("tief. ^2\n");
	});

	it("puts a heading's ID on the heading and a quote's after its last line", () => {
		const content = "# Der See\nEin Text.\n\n> [!note]\n> Der See ist tief.\n> zwei\n\nx 2^10\n";
		const blocks = sourceBlocksOf(content, [
			content.indexOf("See"),
			content.indexOf("See ist"),
			content.indexOf("x 2"),
		]);
		expect([...blocks.values()]).toEqual([
			{ _tag: "Unidentified", mintAt: content.indexOf("\n") },
			{ _tag: "Unidentified", mintAt: content.indexOf("zwei") + 4 },
			{ _tag: "Unidentified", mintAt: content.indexOf("2^10") + 4 },
		]);
	});
});

describe("mintBlockIds cutting a paragraph into sentence blocks", () => {
	/** Mints for `words` of `snapshot`, unchanged meanwhile, and links each word. */
	function mintAndLink(snapshot: string, words: readonly string[], current = snapshot) {
		const occurrences = words.map((word) => at(snapshot, word));
		const minted = mintBlockIds({
			current,
			offsets: occurrences.map(({ from }) => from),
			snapshot,
		});
		const moved = withEdits(snapshot, minted.edits);
		const linked = linkUnitsInScroll({
			current: minted.content,
			edits: occurrences.map((occurrence) => ({
				occurrences: [moved.move(occurrence)],
				ref,
				target,
			})),
			snapshot: moved.content,
		});
		const ids = occurrences.map(({ from }) => minted.ids.get(from));
		return { ids, linked, minted, moved };
	}

	it("gives each Sentence of a paragraph a block and an ID of its own", () => {
		const snapshot =
			"Ja. Der See ist tief. Das Wasser ist kalt! Wer schwimmt?\n\nNext ^3\n";
		const { ids, linked, minted, moved } = mintAndLink(snapshot, ["See", "Wasser", "Wer"]);
		expect(minted.content).toBe(
			"Ja. ^4\n\nDer See ist tief. ^5\n\nDas Wasser ist kalt! ^6\n\nWer schwimmt? ^7\n\nNext ^3\n",
		);
		expect(ids).toEqual(["5", "6", "7"]);
		// The cut also goes into the snapshot the links map from.
		expect(moved.content).toBe(minted.content);
		expect(linked.linked).toEqual([1, 1, 1]);
		expect(linked.content).toContain(`Der ${LINK} ist tief. ^5\n`);
	});

	it("keeps the links, footnotes and emphasis a paragraph already holds", () => {
		const user = "[[Fahrer|der Fahrer]]";
		const own = "[[Worter/de/Lexeme/VERB/f/fah/fahre/🚗 fahren|fährt]]";
		const snapshot = `Heute ${own} ${user} los.[^1] *Er fährt schnell. Der See ist tief.* Siehe [hier. Dort](https://x.de/a.b).\n`;
		const { ids, minted } = mintAndLink(snapshot, ["See"]);
		expect(minted.content).toBe(
			`Heute ${own} ${user} los.[^1] ^0\n\n*Er fährt schnell.* ^1\n\n*Der See ist tief.* ^2\n\nSiehe [hier. Dort](https://x.de/a.b). ^3\n`,
		);
		expect(ids).toEqual(["2"]);
	});

	it("keeps verse and hard breaks inside the Sentences they break", () => {
		const snapshot = "Rose rot,\nVeilchen blau.\nDer See ist tief,  \nund du auch.\n";
		const { ids, minted } = mintAndLink(snapshot, ["See"]);
		expect(minted.content).toBe(
			"Rose rot,\nVeilchen blau. ^0\n\nDer See ist tief,  \nund du auch. ^1\n",
		);
		expect(ids).toEqual(["1"]);
	});

	it("leaves a block that already has an ID whole, however many Sentences it holds", () => {
		const snapshot = "Der See ist tief. Das Wasser ist kalt. ^3\n\nEin Hund. Ein Boot.\n";
		const blocks = sourceBlocksOf(snapshot, [snapshot.indexOf("See")]);
		expect([...blocks.values()]).toEqual([{ _tag: "Identified", id: "3" }]);
		const { ids, minted } = mintAndLink(snapshot, ["See", "Boot"]);
		expect(minted.content).toBe(
			"Der See ist tief. Das Wasser ist kalt. ^3\n\nEin Hund. ^4\n\nEin Boot. ^5\n",
		);
		// Only the unidentified block was asked for: the caller takes ^3 from the block.
		expect(ids).toEqual([undefined, "5"]);
	});

	it("gives a single-Sentence block one ID at its end, as before", () => {
		const snapshot = "Der See ist tief.\n";
		const { ids, minted } = mintAndLink(snapshot, ["See"]);
		expect(minted.content).toBe("Der See ist tief. ^0\n");
		expect(ids).toEqual(["0"]);
	});

	it("cuts the paragraph where the user's typing elsewhere moved it", () => {
		const snapshot = "Der See ist tief. Das Wasser ist kalt.\n";
		const current = `Neu oben.\n\n${snapshot}\nNeu unten.\n`;
		const { ids, linked } = mintAndLink(snapshot, ["See", "Wasser"], current);
		expect(ids).toEqual(["0", "1"]);
		expect(linked.content).toBe(
			`Neu oben.\n\nDer ${LINK} ist tief. ^0\n\nDas ${LINK.replace("|See]]", "|Wasser]]")} ist kalt. ^1\n\nNeu unten.\n`,
		);
		// Typing that runs on from the paragraph changes it: one ID, as before.
		const joined = `${snapshot}Neu unten.\n`;
		expect(mintAndLink(snapshot, ["See"], joined).minted.content).toBe(
			`${joined.trimEnd()} ^0\n`,
		);
	});

	it("never cuts a paragraph the user is typing in: it gets one ID, as before", () => {
		const snapshot = "Der See ist tief. Das Wasser\nist kalt.\n";
		const current = "Der See ist sehr tief. Das Wasser\nist kalt.\n";
		const { ids, minted } = mintAndLink(snapshot, ["See"], current);
		expect(minted.content).toBe("Der See ist sehr tief. Das Wasser\nist kalt. ^0\n");
		expect(ids).toEqual(["0"]);
		expect(minted.edits).toEqual([
			{ from: snapshot.indexOf("kalt.") + 5, text: " ^0", to: snapshot.indexOf("kalt.") + 5 },
		]);
	});

	it("never cuts list items, quotes, headings or footnote definitions", () => {
		const snapshot =
			"- Der See ist tief. Das Wasser ist kalt.\n\n> Der See ist tief. Das Wasser ist kalt.\n\n[^1]: Der See ist tief. Das Wasser ist kalt.\n";
		const offsets = [...snapshot.matchAll(/See/gu)].map(({ index }) => index);
		const minted = mintBlockIds({ current: snapshot, offsets, snapshot });
		expect(minted.content).toBe(
			"- Der See ist tief. Das Wasser ist kalt. ^0\n\n> Der See ist tief. Das Wasser ist kalt. ^1\n\n[^1]: Der See ist tief. Das Wasser ist kalt. ^2\n",
		);
	});

	it("closes and opens `_` and `__` emphasis again at a cut, and never cuts inside inline code", () => {
		const snapshot =
			"_Der See ist tief. Das Wasser ist kalt._ Er kam. __Sie ging. Er lief.__ Ein `Hund. Ein` Boot. Ende hier.\n";
		const { minted } = mintAndLink(snapshot, ["See"]);
		expect(minted.content).toBe(
			"_Der See ist tief._ ^0\n\n_Das Wasser ist kalt._ ^1\n\nEr kam. ^2\n\n__Sie ging.__ ^3\n\n__Er lief.__ ^4\n\nEin `Hund. Ein` Boot. ^5\n\nEnde hier. ^6\n",
		);
		// Classify reads the same Sentences after the cut as before it.
		const texts = (content: string) =>
			scrollSentences(content).sentences.map(({ text }) => text);
		expect(texts(minted.content)).toEqual(texts(snapshot));
	});

	it("cuts only between Classify's Sentences, where the formatter would cut inside one", () => {
		// The formatter ends a Sentence after `*Halt!*`; Classify reads one.
		const snapshot = "Er rief: *Halt!* und der See lief. Sie blieb.\n";
		const { ids, minted } = mintAndLink(snapshot, ["See"]);
		expect(minted.content).toBe(
			"Er rief: *Halt!* und der See lief. ^0\n\nSie blieb. ^1\n",
		);
		expect(ids).toEqual(["0"]);
	});

	it("refuses a cut after which Classify would read other Sentences: one ID, as before", () => {
		const snapshot = "Der See *ist tief. Das Wasser* ist kalt. Ende.\n";
		const { minted } = mintAndLink(snapshot, ["See"]);
		expect(minted.content).toBe(`${snapshot.trimEnd()} ^0\n`);
	});

	it("keeps the file's CRLF line endings", () => {
		const snapshot = "Der See ist tief. Das Wasser ist kalt.\r\nEs regnet.\r\n";
		const { minted } = mintAndLink(snapshot, ["See"]);
		expect(minted.content).toBe(
			"Der See ist tief. ^0\r\n\r\nDas Wasser ist kalt. ^1\r\n\r\nEs regnet. ^2\r\n",
		);
	});
});

describe("mintBlockIds in overlapping runs over one snapshot", () => {
	const snapshot = "Er kam. Der See ist tief. Wir bleiben.\n\nDer Hund schläft. Er träumt.\n";
	const cut = "Er kam. ^0\n\nDer See ist tief. ^1\n\nWir bleiben. ^2\n\n";

	/** Run B mints for `word` of `read` and links it, after run A's write left `current`. */
	function runB(current: string, word: string, read = snapshot, from = read.indexOf(word)) {
		const occurrence = { from, to: from + word.length };
		const minted = mintBlockIds({ current, offsets: [occurrence.from], snapshot: read });
		const linked = linkMinted({
			current: minted.content,
			edits: [{ occurrences: [occurrence], ref, target }],
			minted,
			snapshot: read,
		});
		return { id: minted.ids.get(occurrence.from), linked, minted };
	}

	it("takes the blocks another run cut from the same paragraph, and links into them", () => {
		const a = mintBlockIds({ current: snapshot, offsets: [at(snapshot, "Er kam").from], snapshot });
		expect(a.content).toBe(`${cut}Der Hund schläft. Er träumt.\n`);
		const b = runB(a.content, "See");
		expect(b.id).toBe("1");
		expect(b.minted.content).toBe(a.content);
		expect(b.linked.linked).toEqual([1]);
		expect(b.linked.skipped).toEqual([]);
		expect(b.linked.content).toContain(`Der ${LINK} ist tief. ^1\n`);
	});

	it("finds its Sentence's block by its text once the other run's links landed too, and links into it", () => {
		const a = mintBlockIds({ current: snapshot, offsets: [at(snapshot, "Er kam").from], snapshot });
		const own = "[[Worter/de/Lexeme/VERB/k/kom/komme/🚶 kommen|kam]]";
		const linkedByA = a.content.replace("Er kam.", `Er ${own}.`);
		const b = runB(linkedByA, "See");
		expect(b.id).toBe("1");
		expect(b.minted.content).toBe(linkedByA);
		// The ref it commits is linked, so no unlink check removes it.
		expect(b.linked.linked).toEqual([1]);
		expect(b.linked.skipped).toEqual([]);
		expect(b.linked.content).toBe(linkedByA.replace("Der See", `Der ${LINK}`));
	});

	it("leaves an occurrence unattested when its Sentence is no longer as it read it", () => {
		const a = mintBlockIds({ current: snapshot, offsets: [at(snapshot, "Er kam").from], snapshot });
		const tief = "[[Worter/de/Lexeme/ADJ/t/tie/tief/🕳 tief|tief]]";
		const linkedByA = a.content.replace("ist tief.", `ist ${tief}.`);
		const b = runB(linkedByA, "See");
		// No ref without a link: the unit commits without an Attestation.
		expect(b.id).toBeUndefined();
		expect(b.minted.content).toBe(linkedByA);
		expect(b.linked.linked).toEqual([0]);
	});

	it("never takes an earlier cut of a refrain for the copy the user is typing in", () => {
		const refrain = `${cut}Er kam. Der See ist tief. Wir bleiben.\n`;
		const second = refrain.lastIndexOf("See");
		// Typing before the second copy: no block of its own is found, and
		// the first copy's cut, which the snapshot held, is not taken.
		const before = refrain.replace(/Er kam\. Der/u, "Neu. Er kam. Der");
		const b = runB(before, "See", refrain, second);
		expect(b.id).toBeUndefined();
		expect(b.minted.content).toBe(before);
		expect(b.linked.content.startsWith(cut)).toBe(true);
		// Editing the second copy's Sentence: the one Sentence left with its
		// text is the first copy's, which the snapshot held too.
		const edited = refrain.replace(/ist tief\. Wir bleiben\.\n$/u, "ist sehr tief. Wir bleiben.\n");
		const d = runB(edited, "See", refrain, second);
		expect(d.id).toBeUndefined();
		expect(d.minted.content).toBe(edited);
		expect(d.linked.content.startsWith(cut)).toBe(true);
		// Typing after it: the copy gets an ID of its own, as before.
		const after = `${refrain.trimEnd()} Neu.\n`;
		const c = runB(after, "See", refrain, second);
		expect(c.id).toBe("3");
		expect(c.minted.content).toBe(`${after.trimEnd()} ^3\n`);
		expect(c.linked.content.startsWith(cut)).toBe(true);
	});

	it("cuts its own paragraph when the other run cut another one", () => {
		const a = mintBlockIds({ current: snapshot, offsets: [at(snapshot, "Er kam").from], snapshot });
		const b = runB(a.content, "Hund");
		expect(b.id).toBe("3");
		expect(b.minted.content).toBe(`${cut}Der Hund schläft. ^3\n\nEr träumt. ^4\n`);
		expect(b.linked.linked).toEqual([1]);
	});
});

describe("linkUnitsInScroll", () => {
	it("re-points the plugin's own links and leaves the user's links and embeds alone", () => {
		const content =
			"Der [[Worter/de/Lexeme/NOUN/Masc/See#^r-0|See]] und [[Meer|See]] und [[See]] und ![[See]]. ^0\n";
		const own = content.indexOf("See]] und [[Meer");
		const aliased = content.indexOf("See]] und [[See");
		const bare = content.indexOf("See]] und ![[");
		const embedded = content.lastIndexOf("See");
		const linked = linkUnitsInScroll({
			current: content,
			edits: [
				{
					occurrences: [own, aliased, bare, embedded].map((from) => ({
						from,
						to: from + 3,
					})),
					ref,
					target,
				},
			],
			snapshot: content,
		});
		expect(linked.content).toBe(
			`Der ${LINK} und [[Meer|See]] und [[See]] und ![[See]]. ^0\n`,
		);
		expect(linked.linked).toEqual([1]);
		expect(linked.skipped.map(({ reason }) => reason)).toEqual([
			"inside the user's link",
			"inside the user's link",
			"inside an embed or a Markdown link",
		]);
	});

	it("follows the user's typing elsewhere in the Scroll", () => {
		const snapshot = "Der See ist tief. ^0\n";
		const current = "Ganz neu.\n\nDer See ist tief. ^0\nNoch mehr.\n";
		const linked = linkUnitsInScroll({
			current,
			edits: [{ occurrences: [at(snapshot, "See")], ref, target }],
			snapshot,
		});
		expect(linked.content).toBe(
			`Ganz neu.\n\nDer ${LINK} ist tief. ^0\nNoch mehr.\n`,
		);
	});

	it("leaves tables, code and emphasis that a link would break", () => {
		const content =
			"| See | lake |\n\nEin `See` hier.\n\n```\nSee\n```\n\nDer *See* und See ist.\n";
		const occurrences = [
			at(content, "See |"),
			at(content, "See` hier"),
			{ from: content.indexOf("See\n```"), to: content.indexOf("See\n```") + 3 },
			at(content, "*See* und See"),
		].map(({ from }, index) =>
			index === 3 ? { from, to: from + 13 } : { from, to: from + 3 },
		);
		const linked = linkUnitsInScroll({
			current: content,
			edits: [{ occurrences, ref, target }],
			snapshot: content,
		});
		expect(linked.content).toBe(content);
		expect(linked.skipped.map(({ reason }) => reason)).toEqual([
			"inside a table",
			"inside inline code",
			"inside a code block",
			"its text cannot be a link's shown text",
		]);
		const url = "Siehe https://de.wikipedia.org/wiki/See hier.\n";
		expect(
			linkUnitsInScroll({
				current: url,
				edits: [{ occurrences: [at(url, "See")], ref, target }],
				snapshot: url,
			}).skipped.map(({ reason }) => reason),
		).toEqual(["inside a URL or HTML"]);
	});
});

describe("linkUnitsInScroll over the user's links", () => {
	const reading = "Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/🚗 Fahrer";
	const fahrer = { readingPath: `${reading}.md` };
	/** The source range from the start of `first` to the end of `last`. */
	const span = (content: string, first: string, last: string) => {
		const from = content.indexOf(first);
		const end = content.indexOf(last, from) + last.length;
		return { from, to: end };
	};
	const link = (
		content: string,
		occurrences: { from: number; to: number }[],
		userLinks?: "Keep" | "Replace",
		readingPath = fahrer.readingPath,
	) =>
		linkUnitsInScroll({
			current: content,
			edits: [{ occurrences, ref, target: { readingPath } }],
			snapshot: content,
			...(userLinks === undefined ? {} : { userLinks }),
		});

	it("keeps them by default, quoting the occurrence as a reader sees it", () => {
		const content = "Der [[Fahrer]] fährt. ^0\n";
		const linked = link(content, [span(content, "Der", "Fahrer")]);
		expect(linked.content).toBe(content);
		expect(linked.skipped).toEqual([
			{ reason: "inside the user's link", ref, text: "Der Fahrer" },
		]);
	});

	it("re-points a link of the plugin's that the occurrence takes in", () => {
		const content =
			"Der [[Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/🚗 Fahrer|Fahrer]] fährt. ^0\n";
		expect(link(content, [span(content, "Der", "Fahrer|Fahrer")]).content).toBe(
			`[[${reading}|Der Fahrer]] fährt. ^0\n`,
		);
	});

	it("replaces each link whose shown text lies in the occurrence when told to", () => {
		const content = "Der [[Fahrer]] fährt mit [[Fahrkarte|der Karte]]. ^0\n";
		const linked = link(
			content,
			[span(content, "Der", "Fahrer"), at(content, "der Karte")],
			"Replace",
		);
		expect(linked.content).toBe(
			`[[${reading}|Der Fahrer]] fährt mit [[${reading}|der Karte]]. ^0\n`,
		);
		expect(linked.linked).toEqual([2]);
		expect(linked.skipped).toEqual([]);
	});

	it("replaces the old links of a discontinuous unit's pieces, and splits a contraction as Classify does", () => {
		const verb = "Worter/de/Lexeme/VERB/auf/a/auf/aufpa/⚠ aufpassen";
		const content =
			"Mark, [[aufpassen|Pass]] auf dich [[aufpassen|auf]]! ^19\n\nWir arbeiten im [[Team]]. ^4\n";
		const lastAuf = content.indexOf("auf]]!");
		const pieces = [
			span(content, "Pass", "] auf"),
			{ from: lastAuf, to: lastAuf + 3 },
		];
		expect(link(content, pieces, "Replace", `${verb}.md`).content).toBe(
			`Mark, [[${verb}|Pass auf]] dich [[${verb}|auf]]! ^19\n\nWir arbeiten im [[Team]]. ^4\n`,
		);
		const team = "Worter/de/Lexeme/NOUN/Neut/t/tea/team/👥 Team";
		const contracted = span(content, "m [[Team", "Team");
		expect(
			link(content, [contracted], "Replace", `${team}.md`).content,
		).toContain(`Wir arbeiten i[[${team}|m Team]]. ^4`);
	});

	it("still leaves embeds, Markdown links and links that show more than the occurrence", () => {
		const content =
			"[[Pass auf dich auf]] und ![[Fahrer]] und [Fahrer](https://x.de/a). ^0\n";
		const word = (text: string, from: number) => ({
			from,
			to: from + text.length,
		});
		const linked = link(
			content,
			[
				word("Pass", content.indexOf("Pass")),
				word("Fahrer", content.indexOf("Fahrer]]")),
				word("Fahrer", content.indexOf("Fahrer](")),
			],
			"Replace",
		);
		expect(linked.content).toBe(content);
		expect(linked.skipped.map(({ reason, text }) => `${text}: ${reason}`)).toEqual([
			"Pass: the user's link shows more than it",
			"Fahrer: inside an embed or a Markdown link",
			"Fahrer: inside an embed or a Markdown link",
		]);
	});
});

describe("knowledgeRequestFor", () => {
	const reading = {
		emojiDescription: "🌊",
		lemma: {
			canonicalForm: "See",
			coreFeatures: { gender: "Masc" },
			family: "Lexeme",
			kind: "NOUN",
			language: "de",
			unitKind: "Lemma",
		},
		unitKind: "Reading",
	} as Dumling.Reading<"de">;

	it("asks relations only for a New Reading, and only while the policy publishes them", () => {
		const fresh = knowledgeRequestFor({
			origin: "New",
			reading,
			stored: { pendingRelationKinds: ["synonym"] },
			translationLanguages: ["en"],
		});
		expect(fresh.definition).toBeNull();
		expect(fresh.translations).toEqual({ en: null });
		expect(fresh.semanticRelations?.antonym).toBeNull();
		expect(fresh.semanticRelations).not.toHaveProperty("synonym");
		expect(fresh.semanticRelations).not.toHaveProperty("hyponym");
		expect(
			knowledgeRequestFor({
				origin: "New",
				publishRelations: false,
				reading,
				stored: { pendingRelationKinds: [] },
				translationLanguages: ["en"],
			}),
		).not.toHaveProperty("semanticRelations");
	});

	it("asks a later occurrence only for the base text the entry lacks", () => {
		const request = knowledgeRequestFor({
			origin: "TopUp",
			reading,
			stored: {
				knowledge: { definition: "a lake", translations: { en: [[{ kind: "Text", text: "lake" }]] } },
				pendingRelationKinds: [],
			},
			translationLanguages: ["en", "ru"],
		});
		for (const aspect of Object.keys(request))
			expect(["transcription", "translations"]).toContain(aspect);
		expect(request).not.toHaveProperty("definition");
		expect(request.translations).toEqual({ ru: null });
	});
});
