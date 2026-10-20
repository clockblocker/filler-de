import { describe, expect, it } from "bun:test";
import type * as Dumling from "dumling/types";
import { knowledgeRequestFor } from "../../../../src/commanders/classify/resolution/knowledge-request";
import {
	attestationRefOf,
	linkUnitsInScroll,
	mintBlockIds,
	sourceBlocksOf,
	withAppended,
} from "../../../../src/commanders/classify/resolution/scroll-links";

const target = {
	lemmaPath: "Worter/de/Lexeme/NOUN/Masc/See.md",
	readingBlockId: "r-1a2b3c4d",
};
const ref = { segments: [2], sentenceKey: "k" };
const LINK = "[[Worter/de/Lexeme/NOUN/Masc/See#^r-1a2b3c4d|See]]";

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
		expect(attestationRefOf("Library/Story-Library.md", "4")).toBe(
			"![[Story-Library#^4|^]]",
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
			mintAts: [snapshot.indexOf("\n")],
			snapshot,
		});
		expect(minted.content).toBe("Der See ist tief und kalt ^4\n\nNext ^3\n");
		expect([...minted.ids.values()]).toEqual(["4"]);
		expect(minted.appended).toEqual([]);
	});

	it("keeps an ID a block gained meanwhile", () => {
		const snapshot = "Der See ist tief.\n";
		const minted = mintBlockIds({
			current: "Der See ist tief. ^9\n",
			mintAts: [snapshot.indexOf("\n")],
			snapshot,
		});
		expect(minted.content).toBe("Der See ist tief. ^9\n");
		expect([...minted.ids.values()]).toEqual(["9"]);
	});

	it("reports what it appended to the snapshot it saw, so links map past it", () => {
		const snapshot = "Der See ist tief.\n\nDie See ist rau.\n";
		const minted = mintBlockIds({
			current: snapshot,
			mintAts: [snapshot.indexOf("\n"), snapshot.lastIndexOf("\n")],
			snapshot,
		});
		const moved = withAppended(snapshot, minted.appended);
		expect(moved.content).toBe(minted.content);
		const rau = at(snapshot, "rau");
		expect(moved.content.slice(moved.move(rau).from, moved.move(rau).to)).toBe(
			"rau",
		);
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
				knowledge: { definition: "a lake", translations: { en: ["lake"] } },
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
