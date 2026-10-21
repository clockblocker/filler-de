import { describe, expect, it } from "bun:test";
import { z } from "zod";
import {
	defineNestedNamespace,
	LibraryMetadata,
	type MetadataFormat,
	noteMetadataHelper as meta,
	NoteMetadataError,
} from "../../../src/stateless-helpers/note-metadata";
import { setupGetParsedUserSettingsSpyWithHooks } from "../common-utils/setup-spy";

setupGetParsedUserSettingsSpyWithHooks({ hideMetadata: true });

const OPEN = '<section id="textfresser_meta_keep_me_invisible">';
const FORMATS: readonly MetadataFormat[] = ["Hidden", "Frontmatter"];

const ReadingSchema = z.object({
	emoji: z.string(),
	gloss: z.string(),
	relations: z.array(z.object({ kind: z.string(), target: z.string() })),
});
const DictionarySchema = z.object({
	lemma: z.string(),
	notes: z.string().optional(),
	readings: z.array(ReadingSchema),
});
type DictionaryValue = z.infer<typeof DictionarySchema>;

const Dictionary = defineNestedNamespace<DictionaryValue>({
	key: "dictionary",
	migrations: {
		1: (data) => {
			const { word } = z.object({ word: z.string() }).parse(data);
			return { lemma: word, readings: [] };
		},
	},
	name: "dictionary",
	schema: DictionarySchema,
	version: 2,
});

/** Holds everything that has broken the formats before. */
const TRICKY: DictionaryValue = {
	lemma: "Fahrer </section> [[Fahrer]] %% not a comment %%",
	notes: "line one\nline two: with colon\n---\n#tag ![[embed]] 100%",
	readings: [
		{
			emoji: "🚗",
			gloss: "driver",
			relations: [
				{ kind: "Synonym", target: "[[Worter/l/len/lenke/Lenker|Lenker]]" },
				{ kind: "Antonym", target: '<section id="x">"quoted"</section>' },
			],
		},
		{ emoji: "🏎️", gloss: "racer", relations: [] },
	],
};

describe("note-metadata facility", () => {
	describe("round trips", () => {
		for (const format of FORMATS) {
			it(`keeps nested data with links, comments and </section> (${format})`, () => {
				const written = meta.write(Dictionary, TRICKY, format)("Body text\n");
				expect(meta.read(written, Dictionary, format)).toEqual(TRICKY);
				expect(meta.strip(written)).toBe("Body text");
				if (format === "Hidden") {
					const payload = written.slice(written.indexOf(OPEN));
					expect(payload).not.toContain("[[");
					expect(payload).not.toContain("%%");
					expect(payload.match(/<\/section>/gu)).toHaveLength(1);
				}
			});

			it(`writes schemaVersion with the data (${format})`, () => {
				const written = meta.write(Dictionary, TRICKY, format)("");
				expect(written).toMatch(
					format === "Hidden"
						? /"dictionary":\{"schemaVersion":2,/u
						: /dictionary:\n {2}schemaVersion: 2\n/u,
				);
			});
		}

		it("keeps the Library's frontmatter checkbox and writes no injected status", () => {
			const page = meta.write(
				LibraryMetadata,
				{ noteKind: "Page", status: "Done" },
				"Frontmatter",
			)("Text\n");
			expect(page).toBe("---\nnoteKind: Page\nstatus: true\n---\nText\n");
			expect(meta.read(page, LibraryMetadata)).toEqual({
				noteKind: "Page",
				status: "Done",
			});

			const codex = meta.write(
				LibraryMetadata,
				{ fileType: "Codex" },
				"Frontmatter",
			)("Children\n");
			expect(codex).toBe("---\nfileType: Codex\n---\nChildren\n");
		});

		it("writes the Library's hidden layout as before", () => {
			expect(
				meta.write(LibraryMetadata, { status: "Done" }, "Hidden")("Content"),
			).toBe(`Content${"\n".repeat(20)}${OPEN}\n{"status":"Done"}\n</section>\n`);
		});

		it("reads legacy frontmatter status values", () => {
			for (const [stored, status] of [
				["true", "Done"],
				["done", "Done"],
				["Completed", "Done"],
				["false", "NotStarted"],
				["whatever", "NotStarted"],
			] as const) {
				const content = `---\nstatus: ${stored}\n---\nText`;
				expect(meta.read(content, LibraryMetadata)?.status).toBe(status);
			}
		});
	});

	describe("frontmatter", () => {
		it("keeps the user's properties and their order", () => {
			const content = "---\ntags:\n  - a\n  - b\nstatus: false\naliases: [x]\n---\nText\n";
			const written = meta.write(LibraryMetadata, { status: "Done" }, "Frontmatter")(content);
			expect(written).toBe(
				"---\ntags:\n  - a\n  - b\nstatus: true\naliases:\n  - x\n---\nText\n",
			);
		});

		it("leaves the block untouched when nothing changes", () => {
			const content = "---\n# a comment\nstatus:   true\n---\nText\n";
			expect(
				meta.write(LibraryMetadata, { status: "Done" }, "Frontmatter")(content),
			).toBe(content);
		});

		it("parses an empty block", () => {
			const written = meta.write(LibraryMetadata, { status: "Done" }, "Frontmatter")(
				"---\n---\nText\n",
			);
			expect(written).toBe("---\nstatus: true\n---\nText\n");
		});

		it("refuses to overwrite frontmatter it cannot parse", () => {
			const content = "---\n: : [unclosed\n---\nText\n";
			expect(() =>
				meta.write(LibraryMetadata, { status: "Done" }, "Frontmatter")(content),
			).toThrow(NoteMetadataError);
			const hidden = meta.write(LibraryMetadata, { status: "Done" }, "Hidden")(content);
			expect(hidden.startsWith("---\n: : [unclosed\n---\nText")).toBe(true);
		});
	});

	describe("namespaces", () => {
		it("touches only their own keys", () => {
			const withLibrary = meta.write(LibraryMetadata, { status: "Done" }, "Hidden")(
				`Text${"\n".repeat(20)}${OPEN}\n{"prevPageIdx":0,"status":"NotStarted"}\n</section>\n`,
			);
			const both = meta.write(Dictionary, TRICKY, "Hidden")(withLibrary);
			expect(meta.read(both, LibraryMetadata)).toEqual({ status: "Done" });
			expect(meta.read(both, Dictionary)).toEqual(TRICKY);
			expect(both).toContain('"prevPageIdx":0');

			const withoutDictionary = meta.remove(Dictionary)(both);
			expect(withoutDictionary).toBe(withLibrary);
			expect(meta.remove(LibraryMetadata)(withoutDictionary)).toBe(
				`Text${"\n".repeat(20)}${OPEN}\n{"prevPageIdx":0}\n</section>\n`,
			);
		});

		it("drops the section when its last namespace is removed", () => {
			const written = meta.write(Dictionary, TRICKY, "Hidden")("Text\n");
			expect(meta.remove(Dictionary)(written)).toBe("Text\n");
		});

		it("rejects a value that breaks the schema", () => {
			expect(() =>
				meta.write(
					Dictionary,
					{ lemma: 1 } as unknown as DictionaryValue,
					"Hidden",
				)("Text"),
			).toThrow(NoteMetadataError);
		});
	});

	describe("versions", () => {
		const stored = (data: unknown) =>
			`Text\n${OPEN}\n${JSON.stringify({ dictionary: data })}\n</section>\n`;

		it("migrates older data on read", () => {
			expect(meta.read(stored({ schemaVersion: 1, word: "Fahrer" }), Dictionary)).toEqual({
				lemma: "Fahrer",
				readings: [],
			});
		});

		it("reports newer, unversioned and mismatched data", () => {
			expect(meta.inspect(stored({ lemma: "x", schemaVersion: 3 }), Dictionary, "Hidden")).toEqual({
				format: "Hidden",
				issue: { found: 3, kind: "NewerVersion", supported: 2 },
				kind: "Invalid",
			});
			expect(meta.inspect(stored({ lemma: "x" }), Dictionary, "Hidden")).toMatchObject({
				issue: { kind: "MissingVersion" },
			});
			expect(meta.inspect(stored({ lemma: 1, schemaVersion: 2 }), Dictionary, "Hidden")).toMatchObject({
				issue: { kind: "SchemaMismatch" },
			});
		});

		it("update refuses to overwrite data it cannot read", () => {
			const newer = stored({ lemma: "x", schemaVersion: 3 });
			expect(() =>
				meta.update(Dictionary, () => TRICKY, "Hidden")(newer),
			).toThrow(NoteMetadataError);
		});

		it("update writes migrated data at the current version", () => {
			const updated = meta.update(
				Dictionary,
				(current) => current && { ...current, notes: "n" },
				"Hidden",
			)(stored({ schemaVersion: 1, word: "Fahrer" }));
			expect(updated).toContain(
				'{"dictionary":{"schemaVersion":2,"lemma":"Fahrer","notes":"n","readings":[]}}',
			);
		});
	});

	describe("reading across formats", () => {
		const both = `---\nstatus: false\n---\nText\n${OPEN}\n{"status":"Done"}\n</section>\n`;

		it("prefers the given format and falls back to the other", () => {
			expect(meta.read(both, LibraryMetadata, "Hidden")?.status).toBe("Done");
			expect(meta.read(both, LibraryMetadata, "Frontmatter")?.status).toBe(
				"NotStarted",
			);
			const hiddenOnly = `Text\n${OPEN}\n{"status":"Done"}\n</section>\n`;
			expect(meta.read(hiddenOnly, LibraryMetadata, "Frontmatter")?.status).toBe(
				"Done",
			);
		});

		it("a write moves the namespace out of the other format", () => {
			const toHidden = meta.write(LibraryMetadata, { status: "Done" }, "Hidden")(both);
			expect(toHidden).toBe(`Text${"\n".repeat(20)}${OPEN}\n{"status":"Done"}\n</section>\n`);
			const toFrontmatter = meta.write(
				LibraryMetadata,
				{ status: "Done" },
				"Frontmatter",
			)(both);
			expect(toFrontmatter).toBe("---\nstatus: true\n---\nText\n");
		});
	});

	describe("visible text", () => {
		it("strip, body and findSectionStart ignore both formats", () => {
			const content = `---\ntitle: T\n---\nBody here\n\n\n${OPEN}\n{"status":"Done"}\n</section>\n`;
			expect(meta.strip(content)).toBe("Body here");
			expect(meta.body(content)).toBe("Body here\n\n\n");
			expect(content.slice(0, meta.findSectionStart(content) ?? 0)).toBe(
				"---\ntitle: T\n---\nBody here",
			);
			expect(meta.stripOnlyFrontmatter(content).startsWith("Body here")).toBe(true);
		});

		it("never reads visible content as data", () => {
			const content = `Body ${OPEN}{"status":"Done"}</section> more text\n`;
			expect(meta.read(content, LibraryMetadata)).toBeNull();
			expect(meta.strip(content)).toBe(content.trim());
			expect(meta.findSectionStart(content)).toBeNull();
		});
	});
});
