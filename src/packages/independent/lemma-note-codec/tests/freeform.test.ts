import { describe, expect, it } from "bun:test";
import {
	NOTE_PLACEHOLDER,
	type SerializedNote,
	serializeLemmaNote,
	serializeReadingNote,
} from "../src";
import { mutterNut, mutterParent, nounData } from "./fixtures";
import {
	freeformTexts,
	lemmaNoteDataOf,
	parseLemma,
	parseReading,
	readingNoteDataOf,
	valid,
} from "./helpers";

const parent = mutterParent;
const nut = mutterNut;

const NOTE_TITLE =
	'<span class="note_block_title note_block_title_kontexte">Note</span>';
const SYNONYME =
	'<span class="note_block_title note_block_title_synonyme">Semantische Beziehungen</span>';

/** A note whose body a user edited, its metadata as it was. */
const edit = <M>(
	note: SerializedNote<M>,
	change: (body: string) => string,
): SerializedNote<M> => ({ ...note, body: change(note.body) });

const nutNote = serializeReadingNote(nounData, nut);

/** parse, then serialize again over what was parsed. */
function rewrite(note: SerializedNote<unknown>) {
	const parsed = parseReading(note);
	return serializeReadingNote(nounData, nut, { previous: parsed.document });
}

describe("freeform in a Reading note", () => {
	it("takes the placeholder's place when typed there, and survives byte for byte", () => {
		const typed = edit(nutNote, (body) =>
			body.replace(
				`${NOTE_PLACEHOLDER}\n`,
				"Seen at the Rhine.  \n\n\tAsk about Muttern.\n",
			),
		);
		const parsed = parseReading(typed);
		expect(freeformTexts(parsed)).toEqual([
			"Seen at the Rhine.  \n\n\tAsk about Muttern.",
		]);
		const again = rewrite(typed);
		expect(again.body).toContain(
			`${NOTE_TITLE}\nSeen at the Rhine.  \n\n\tAsk about Muttern.\n\n\n`,
		);
		expect(again.body).not.toContain(NOTE_PLACEHOLDER);
		expect(rewrite(again)).toEqual(again);
		expect(valid(parseReading(again).data)).toEqual(
			readingNoteDataOf(nounData, nut),
		);
	});

	it("moves text typed anywhere else under the Note title", () => {
		const typed = edit(
			nutNote,
			(body) => `Above the header\n${body}below all\n`,
		);
		const again = rewrite(typed);
		expect(again.body).toContain(
			`${NOTE_TITLE}\nAbove the header\n\nbelow all\n\n\n`,
		);
		expect(again.body.split("Above the header")).toHaveLength(2);
		expect(rewrite(again)).toEqual(again);
	});

	it("keeps an edited rendering as freeform, never reading it as data", () => {
		const edited = edit(nutNote, (body) =>
			body.replace("\nnut\n", "\nnut, bolt nut\n"),
		);
		const parsed = parseReading(edited);
		// The data is the metadata's, whatever the visible lines say.
		expect(valid(parsed.data)).toEqual(readingNoteDataOf(nounData, nut));
		expect(freeformTexts(parsed)).toEqual([
			'<span class="note_block_title note_block_title_translations">Übersetzung</span>\nnut, bolt nut',
		]);
		const again = rewrite(edited);
		// The fresh rendering and the user's edit, under the Note title.
		expect(again.body).toContain("\nnut\n");
		expect(again.body).toContain(`${NOTE_TITLE}\n`);
		expect(again.body).toContain("nut, bolt nut");
		expect(rewrite(again)).toEqual(again);
	});

	it("drops a freeform run that holds only the placeholder, and writes it once", () => {
		const touched = edit(nutNote, (body) =>
			body.replace(`${NOTE_PLACEHOLDER}\n`, `${NOTE_PLACEHOLDER} \n`),
		);
		expect(freeformTexts(parseReading(touched))).toEqual([
			`${NOTE_PLACEHOLDER} `,
		]);
		const again = rewrite(touched);
		expect(again).toEqual(nutNote);
		expect(again.body.split(NOTE_PLACEHOLDER)).toHaveLength(2);
	});

	it("brings the placeholder back once the user's text is gone", () => {
		const written = rewrite(
			edit(nutNote, (body) =>
				body.replace(`${NOTE_PLACEHOLDER}\n`, "mine\n"),
			),
		);
		expect(
			rewrite(edit(written, (body) => body.replace("mine\n", ""))),
		).toEqual(nutNote);
	});

	it("puts freeform after the notes, and shows no placeholder beside notes", () => {
		const note = serializeReadingNote(nounData, parent);
		expect(note.body).not.toContain(NOTE_PLACEHOLDER);
		const typed = edit(note, (body) =>
			body.replace(`\n\n\n${SYNONYME}`, `\nmine\n\n\n${SYNONYME}`),
		);
		const again = serializeReadingNote(nounData, parent, {
			previous: parseReading(typed).document,
		});
		expect(again.body).toContain(`inside.\nmine\n\n\n${SYNONYME}`);
	});
});

describe("freeform in a Lemma note", () => {
	const lemmaNote = serializeLemmaNote(nounData);
	const lemmaRewrite = (note: SerializedNote<unknown>) =>
		serializeLemmaNote(nounData, { previous: parseLemma(note).document });

	it("stands last, byte for byte, wherever it was typed", () => {
		const typed = edit(lemmaNote, (body) =>
			body.replace("\n\n", "\n\nbetween the header and the links\n\n"),
		);
		const again = lemmaRewrite(typed);
		expect(
			again.body.endsWith("\n\nbetween the header and the links\n"),
		).toBe(true);
		expect(lemmaRewrite(again)).toEqual(again);
		expect(valid(parseLemma(again).data)).toEqual(
			lemmaNoteDataOf(nounData),
		);
	});

	it("keeps an edited Surface line without its Block ID beside the fresh one", () => {
		const line = lemmaNote.body
			.split("\n")
			.find((candidate) => candidate.startsWith("- Mütter"));
		if (line === undefined) throw new Error("no Surface line");
		const edited = edit(lemmaNote, (body) =>
			body.replace(line, line.replace("- Mütter", "- Mütter (my note)")),
		);
		const again = lemmaRewrite(edited);
		const id = line.match(/\^s-[0-9a-f]+$/u)?.[0] ?? "";
		expect(again.body.split(id)).toHaveLength(2);
		expect(again.body.endsWith("\n- Mütter (my note)\n")).toBe(true);
		expect(lemmaRewrite(again)).toEqual(again);
	});
});
