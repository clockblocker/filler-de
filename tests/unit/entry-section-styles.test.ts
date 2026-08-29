import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

describe("entry section title styles", () => {
	test("supports legacy note_block_title markup alongside current markup", () => {
		expect(styles).toContain(".note_block_title,\n.entry_section_title {");
		expect(styles).toContain(
			".cm-html-embed > .note_block_title,\n.cm-html-embed > .entry_section_title {",
		);
		expect(styles).toContain(
			".note_block_title.note_block_title_formen,\n.entry_section_title.entry_section_title_formen {",
		);
		expect(styles).toContain(
			".note_block_title.note_block_title_kontexte,\n.entry_section_title.entry_section_title_kontexte {",
		);
	});
});
