import { describe, expect, it } from "bun:test";
import {
	attestationRef,
	type LemmaRecords,
	parseAttestationRef,
	retargetedRefLines,
	type SerializedNote,
	serializeReadingNote,
} from "../src";
import { mutterParent, nounData } from "./fixtures";
import { freeformTexts, parseReading } from "./helpers";

const STORY_0 = "![[Story#^0|^1a2b3c4d]]";
const STORY_1 = "![[Story#^1|^5e6f7a8b]]";
const TALE_0 = "![[Tale#^0|^1a2b3c4d]]";
const TALE_1 = "![[Library/Tale#^1|^5e6f7a8b]]";

/** Mutter 👩 with two occurrences in Story. */
const records: LemmaRecords<"de"> = {
	...nounData,
	readingEntries: nounData.readingEntries.map((entry) =>
		entry.reading === mutterParent
			? {
					...entry,
					attestationLinks: [STORY_0, STORY_1].map((ref) => ({
						reading: mutterParent,
						ref,
						surfaceId: null,
					})),
				}
			: entry,
	),
};

const note = serializeReadingNote(records, mutterParent);

const edit = <M>(
	written: SerializedNote<M>,
	change: (body: string) => string,
): SerializedNote<M> => ({ ...written, body: change(written.body) });

/** The note as Obsidian's link updater leaves it once Story is Tale. */
const retargeted = edit(note, (body) =>
	body.replace(STORY_0, TALE_0).replace(STORY_1, TALE_1),
);

describe("Attestation Refs", () => {
	it("reads back what it writes, by basename or by path", () => {
		expect(parseAttestationRef(STORY_0)).toEqual({
			blockId: "0",
			linkpath: "Story",
			occurrence: "1a2b3c4d",
		});
		expect(parseAttestationRef(TALE_1)).toEqual({
			blockId: "1",
			linkpath: "Library/Tale",
			occurrence: "5e6f7a8b",
		});
		expect(
			attestationRef({
				blockId: "1",
				linkpath: "Library/Tale",
				occurrence: "5e6f7a8b",
			}),
		).toBe(TALE_1);
		expect(parseAttestationRef("![[Story#^0|^]]")).toBeUndefined();
	});

	it("finds whole lines that show a stored ref by another link path", () => {
		expect(
			retargetedRefLines(
				[STORY_0, TALE_1, `see ${TALE_0}`, "![[Tale#^9|^1a2b3c4d]]"],
				[STORY_0, STORY_1],
			),
		).toEqual([{ line: 1, linkpath: "Library/Tale", ref: STORY_1 }]);
	});
});

describe("a Reading note whose Kontexte Obsidian retargeted", () => {
	it("still reads them as the rendering, and names the refs it retargeted", () => {
		expect(freeformTexts(parseReading(note))).toEqual([]);
		const parsed = parseReading(retargeted);
		expect(freeformTexts(parsed)).toEqual([]);
		expect(parsed.document.retargeted).toEqual([
			{ linkpath: "Tale", ref: STORY_0 },
			{ linkpath: "Library/Tale", ref: STORY_1 },
		]);
	});

	it("writes the rendering once when the note is serialized again", () => {
		const parsed = parseReading(retargeted);
		const again = serializeReadingNote(records, mutterParent, {
			previous: parsed.document,
		});
		expect(again.body).toBe(note.body);
		expect(again.body).not.toContain("Tale");
	});

	it("leaves a ref the user copied into their text as theirs", () => {
		const copied = edit(retargeted, (body) => `${body}\n${TALE_0}\n`);
		const parsed = parseReading(copied);
		expect(freeformTexts(parsed)).toEqual([TALE_0]);
		expect(parsed.document.retargeted).toHaveLength(2);
	});

	it("reads an edited Kontexte block as freeform, as any edited rendering", () => {
		const edited = edit(retargeted, (body) =>
			body.replace(TALE_0, `${TALE_0} mein Kommentar`),
		);
		const parsed = parseReading(edited);
		expect(parsed.document.retargeted).toBeUndefined();
		expect(freeformTexts(parsed).join("\n")).toContain(TALE_1);
	});

	it("reads a Kontexte block the user deleted an embed from as freeform", () => {
		const deleted = edit(retargeted, (body) =>
			body.replace(`${TALE_0}\n`, ""),
		);
		const parsed = parseReading(deleted);
		expect(parsed.document.retargeted).toBeUndefined();
		expect(freeformTexts(parsed).join("\n")).toContain(TALE_1);
		const again = serializeReadingNote(records, mutterParent, {
			previous: parsed.document,
		});
		expect(again.body).toContain(TALE_1);
	});

	it("reads a Kontexte block the user added a line to as freeform", () => {
		const commented = edit(retargeted, (body) =>
			body.replace(TALE_0, `${TALE_0}\nmein Kommentar`),
		);
		const parsed = parseReading(commented);
		expect(parsed.document.retargeted).toBeUndefined();
		const freeform = freeformTexts(parsed).join("\n");
		expect(freeform).toContain("mein Kommentar");
		expect(freeform).toContain(TALE_0);
	});
});
