/**
 * Dictionary notes on the note-metadata facility (#112): both formats, the
 * frontmatter link escape, the "Hide metadata" toggle, and the user's text
 * and properties through every write.
 */
import { describe, expect, it } from "bun:test";
import { parse as parseYaml } from "yaml";
import {
	readLemmaNote,
	readReadingNote,
	writeLemmaNote,
	writeReadingNote,
} from "../../../src/stateless-helpers/dictionary-notes";
import {
	LemmaNoteMetadata,
	type MetadataFormat,
	noteMetadataHelper as meta,
	NoteMetadataError,
	ReadingNoteMetadata,
} from "../../../src/stateless-helpers/note-metadata";
import { setupGetParsedUserSettingsSpyWithHooks } from "../common-utils/setup-spy";
import {
	kohlekraftwerk,
	kohlekraftwerkReading,
	mutter,
	mutterParent,
} from "./layout-fixtures";

setupGetParsedUserSettingsSpyWithHooks({ hideMetadata: true });

const FORMATS: readonly MetadataFormat[] = ["Hidden", "Frontmatter"];
const NAMESPACES = [LemmaNoteMetadata, ReadingNoteMetadata];
const de = { language: "de" } as const;

const writeReading = (format: MetadataFormat) =>
	writeReadingNote(kohlekraftwerk, kohlekraftwerkReading, { ...de, format });
const writeLemma = (format: MetadataFormat) =>
	writeLemmaNote(mutter, { ...de, format });

function readingData(content: string) {
	const read = readReadingNote(content, de);
	if (read._tag !== "Parsed" || !read.parse.data.ok)
		throw new Error("Expected a readable Reading note");
	return read.parse.data.data;
}

function lemmaData(content: string) {
	const read = readLemmaNote(content, de);
	if (read._tag !== "Parsed" || !read.parse.data.ok)
		throw new Error("Expected a readable Lemma note");
	return read.parse.data.data;
}

/** The YAML frontmatter block of a note, without its delimiters. */
const frontmatterOf = (content: string) =>
	content.match(/^---\n([\s\S]*?)\n---\n/u)?.[1] ?? "";

describe("both metadata formats", () => {
	for (const format of FORMATS) {
		it(`${format}: a note round-trips its records, and the body is the codec's alone`, () => {
			const content = writeReading(format)("");
			expect(readingData(content).readingEntry.attestationLinks).toEqual(
				kohlekraftwerk.readingEntries[0]?.attestationLinks ?? [],
			);
			expect(meta.strip(content).startsWith("🏭 das [[")).toBe(true);
			expect(lemmaData(writeLemma(format)("")).lemmaRecord).toEqual(
				mutter.lemmaRecord,
			);
		});

		it(`${format}: writing again changes no byte`, () => {
			const content = writeReading(format)("");
			expect(writeReading(format)(content)).toBe(content);
			const lemma = writeLemma(format)("");
			expect(writeLemma(format)(lemma)).toBe(lemma);
		});

		it(`${format}: keeps the user's freeform and frontmatter properties`, () => {
			const written = writeReading(format)("---\naliases:\n  - Kraftwerk aus Kohle\n---\n");
			const typed = meta.mapBody((body) =>
				body.replace("*You can write here*", "Seen at the Rhine."),
			)(written);
			const again = writeReading(format)(typed);
			expect(meta.strip(again)).toContain(
				'<span class="note_block_title note_block_title_kontexte">Note</span>\nSeen at the Rhine.\n',
			);
			expect(parseYaml(frontmatterOf(again)).aliases).toEqual([
				"Kraftwerk aus Kohle",
			]);
			expect(readingData(again)).toEqual(readingData(written));
		});
	}

	it("Hidden: no link, embed or comment of the data reaches the visible text or the index", () => {
		const content = writeReading("Hidden")("");
		const section = content.slice(content.indexOf("<section"));
		expect(section).not.toContain("[[");
		expect(section).not.toContain("%%");
		// Each embed shows once, in Deine Kontexte.
		expect(content.split("![[Atom#^13|^]]")).toHaveLength(2);
	});

	it("Frontmatter: `[` is escaped in every string, so Obsidian indexes no link", () => {
		const content = writeReading("Frontmatter")("");
		const yaml = frontmatterOf(content);
		expect(yaml).not.toContain("[[");
		expect(content.split("![[Atom#^13|^]]")).toHaveLength(2);
		const stored = parseYaml(yaml).readingNote;
		expect(stored.attestationLinks[0].ref).toBe("!\\[\\[Atom#^13|^]]");
		expect(JSON.stringify(stored)).not.toContain('"[');
		// The escape is undone on read.
		expect(readingData(content).readingEntry.attestationLinks[0]?.ref).toBe(
			"![[Atom#^13|^]]",
		);
	});

	it("Frontmatter: a backslash and a bracket in user content survive the escape", () => {
		const records = {
			...mutter,
			readingEntries: mutter.readingEntries.map((entry) => ({
				...entry,
				notes: "a \\[ b ]] c \\\\ [[d]]",
			})),
		};
		const content = writeReadingNote(records, mutterParent, {
			...de,
			format: "Frontmatter",
		})("");
		expect(frontmatterOf(content)).not.toContain("[[");
		expect(readingData(content).readingEntry.notes).toBe("a \\[ b ]] c \\\\ [[d]]");
	});
});

describe('toggling "Hide metadata" moves dictionary data', () => {
	it("Hidden → Frontmatter → Hidden keeps the records and gives the same note back", () => {
		const hidden = writeReading("Hidden")("");
		const toFrontmatter = meta.convertNote(hidden, "Frontmatter", NAMESPACES);
		expect(toFrontmatter.moved).toEqual(["reading-note"]);
		expect(frontmatterOf(toFrontmatter.content)).not.toContain("[[");
		expect(readingData(toFrontmatter.content)).toEqual(readingData(hidden));
		const back = meta.convertNote(toFrontmatter.content, "Hidden", NAMESPACES);
		expect(back.content).toBe(hidden);
	});

	it("a note not yet migrated still reads, and its next write moves it", () => {
		const frontmatter = writeLemma("Frontmatter")("");
		expect(lemmaData(frontmatter)).toEqual(lemmaData(writeLemma("Hidden")("")));
		const moved = writeLemma("Hidden")(frontmatter);
		expect(moved.startsWith("---")).toBe(false);
		expect(moved).toBe(writeLemma("Hidden")(""));
	});
});

describe("what the facility cannot read is never overwritten", () => {
	it("a newer schemaVersion is reported, and a write throws", () => {
		const content = writeLemma("Hidden")("").replace(
			'"schemaVersion":1',
			'"schemaVersion":9',
		);
		expect(readLemmaNote(content, de)).toMatchObject({
			_tag: "UnreadableMetadata",
			issue: { kind: "NewerVersion" },
		});
		expect(() => writeLemma("Hidden")(content)).toThrow(NoteMetadataError);
	});

	it("a note in the marker format parses to a typed issue, never a throw", () => {
		const read = readLemmaNote("%%tf-part:lemma%%\n%%tf:identity {}%%\n", de);
		expect(read).toMatchObject({
			_tag: "Parsed",
			parse: {
				data: {
					issues: [{ _tag: "LegacyMarkerFormat" }, { _tag: "MissingMetadata" }],
					ok: false,
				},
			},
		});
	});
});
