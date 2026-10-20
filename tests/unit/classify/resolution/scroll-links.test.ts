import { describe, expect, it } from "bun:test";
import type * as Dumling from "dumling/types";
import { knowledgeRequestFor } from "../../../../src/commanders/classify/resolution/knowledge-request";
import {
	attestationRefOf,
	linkUnitsInScroll,
	sourceBlocksOf,
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
	it("finds a block's ID and mints one per block that has none", () => {
		const content = "Eins zwei. ^4\n\nDrei vier\nfünf.\n\n- sechs\n- sieben ^x\n";
		const blocks = sourceBlocksOf(content, [
			content.indexOf("zwei"),
			content.indexOf("Drei"),
			content.indexOf("fünf"),
			content.indexOf("sechs"),
			content.indexOf("sieben"),
		]);
		expect([...blocks.values()]).toEqual([
			{ id: "4" },
			{ id: "5", mintAt: content.indexOf("fünf.") + 5 },
			{ id: "5", mintAt: content.indexOf("fünf.") + 5 },
			{ id: "6", mintAt: content.indexOf("sechs") + 5 },
			{ id: "x" },
		]);
		expect(attestationRefOf("Library/Story-Library.md", "4")).toBe(
			"![[Story-Library#^4|^]]",
		);
	});
});

describe("linkUnitsInScroll", () => {
	it("re-links an existing link's shown text instead of nesting links", () => {
		const content = "Der [[See]] und [[Meer|See]] und ![[See]]. ^0\n";
		const shown = content.indexOf("See]] und [[Meer");
		const aliased = content.indexOf("See]] und ![[");
		const embedded = content.lastIndexOf("See");
		const linked = linkUnitsInScroll({
			current: content,
			edits: [
				{
					occurrences: [
						{ from: shown, to: shown + 3 },
						{ from: aliased, to: aliased + 3 },
						{ from: embedded, to: embedded + 3 },
					],
					ref,
					target,
				},
			],
			mints: [],
			snapshot: content,
		});
		expect(linked.content).toBe(`Der ${LINK} und ${LINK} und ![[See]]. ^0\n`);
		expect(linked.linked).toEqual([2]);
		expect(linked.skipped.map(({ reason }) => reason)).toEqual([
			"inside an embed or a Markdown link",
		]);
	});

	it("follows the user's typing and adds a minted block ID", () => {
		const snapshot = "Der See ist tief.\n";
		const current = "Ganz neu.\n\nDer See ist tief.\n";
		const linked = linkUnitsInScroll({
			current,
			edits: [{ occurrences: [at(snapshot, "See")], ref, target }],
			mints: [{ at: snapshot.indexOf("\n"), id: "7" }],
			snapshot,
		});
		expect(linked.content).toBe(`Ganz neu.\n\nDer ${LINK} ist tief. ^7\n`);
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
