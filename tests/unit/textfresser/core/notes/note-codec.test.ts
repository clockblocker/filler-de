import { describe, expect, it } from "bun:test";
import { createNoteCodec } from "../../../../../src/commanders/textfresser/core/notes/note-codec";
import { deLanguagePack } from "../../../../../src/commanders/textfresser/languages/de/pack";

const codec = createNoteCodec(deLanguagePack);

describe("createNoteCodec", () => {
	it("claims known sections and keeps unclaimable known markers as raw sections", () => {
		const noteText = [
			"haus ^LX-LM-NOUN-1",
			"",
			"Manual intro",
			"",
			'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>',
			"house",
			'<span class="entry_section_title entry_section_title_translations">Custom Title</span>',
			"manual translation",
		].join("\n");

		const [entry] = codec.parse(noteText);
		expect(entry).toBeDefined();
		expect(entry?.sections).toHaveLength(3);
		expect(entry?.sections[0]).toMatchObject({
			kind: "raw",
			rawBlock: "\n\nManual intro\n\n",
		});
		expect(entry?.sections[1]).toMatchObject({
			content: "house",
			key: "translation",
			kind: "typed",
			marker: "translations",
			title: "Übersetzung",
		});
		expect(entry?.sections[2]).toMatchObject({
			kind: "raw",
			key: "translation",
			marker: "translations",
			rawBlock:
				'<span class="entry_section_title entry_section_title_translations">Custom Title</span>\nmanual translation',
			title: "Custom Title",
		});
	});

	it("serializes typed and raw sections while preserving raw blocks verbatim", () => {
		const noteText = [
			"haus ^LX-LM-NOUN-1",
			"",
			"Manual intro",
			"",
			'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>',
			"house",
			'<span class="entry_section_title entry_section_title_translations">Custom Title</span>',
			"manual translation",
		].join("\n");

		const parsed = codec.parse(noteText);
		const serialized = codec.serialize(parsed);

		expect(serialized.body).toBe(`\n${noteText.replace("house", "house ")}`);
		expect(serialized.meta).toEqual({});
	});

	it("preserves raw sections byte-for-byte including surrounding blank lines", () => {
		const noteText = [
			"haus ^LX-LM-NOUN-1",
			"",
			"",
			"Manual intro",
			"",
			"",
			'<span class="entry_section_title entry_section_title_translations">Custom Title</span>',
			"",
			"manual translation",
			"",
			"",
		].join("\n");

		const [entry] = codec.parse(noteText);
		expect(entry?.sections[0]).toMatchObject({
			kind: "raw",
			rawBlock: "\n\n\nManual intro\n\n\n",
		});
		expect(entry?.sections[1]).toMatchObject({
			kind: "raw",
			rawBlock:
				'<span class="entry_section_title entry_section_title_translations">Custom Title</span>\n\nmanual translation\n\n',
		});

		expect(codec.serialize(codec.parse(noteText)).body).toBe(`\n${noteText}`);
	});

	it("keeps duplicate recognized sections raw after the first claimed section", () => {
		const noteText = [
			"haus ^LX-LM-NOUN-1",
			"",
			'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>',
			"house",
			"",
			'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>',
			"dwelling",
		].join("\n");

		const [entry] = codec.parse(noteText);
		const typedSections =
			entry?.sections.filter((section) => section.kind === "typed") ?? [];
		const rawSections =
			entry?.sections.filter((section) => section.kind === "raw") ?? [];
		expect(typedSections[0]).toMatchObject({
			key: "translation",
			kind: "typed",
		});
		expect(rawSections[0]).toMatchObject({
			kind: "raw",
			rawBlock: "\n\n",
		});
		expect(rawSections[1]).toMatchObject({
			key: "translation",
			rawBlock:
				'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>\ndwelling',
		});

		expect(codec.serialize(codec.parse(noteText)).body).toBe(
			`\n${noteText.replace("house", "house ")}`,
		);
	});

	it("serializes entry metadata in the current entries map format", () => {
		const noteText = [
			"haus ^LX-LM-NOUN-1",
			"",
			'<span class="entry_section_title entry_section_title_tags">Tags</span>',
			"#noun/common",
		].join("\n");
		const [entry] = codec.parse(noteText);
		expect(entry).toBeDefined();
		if (!entry) {
			return;
		}
		entry.meta = { foo: "bar" };

		const serialized = codec.serialize([entry]);
		expect(serialized.meta).toEqual({
			entries: {
				"LX-LM-NOUN-1": {
					foo: "bar",
				},
			},
		});
	});
});
