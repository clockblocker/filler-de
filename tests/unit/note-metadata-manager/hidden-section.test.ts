import { describe, expect, it } from "bun:test";
import {
	formatHiddenSection,
	locateHiddenSection,
} from "../../../src/stateless-helpers/note-metadata/internal/hidden-section";

const OPEN = '<section id="textfresser_meta_keep_me_invisible">';

describe("hidden section", () => {
	it("reads a section that ends the file", () => {
		const content = `Body${"\n".repeat(20)}${OPEN}\n{"status":"Done"}\n</section>\n`;
		expect(locateHiddenSection(content)?.document).toEqual({
			status: "Done",
		});
	});

	it("reads legacy layouts: one line, inner spaces, short padding, trailing blank lines", () => {
		for (const content of [
			`Body\n${OPEN}{"status":"Done"}</section>\n`,
			`Body\n\n\n${OPEN}\n  {"status":"Done"}\n</section>\n\n\n`,
			`${OPEN}\n{"status":"Done"}\n</section>`,
		]) {
			expect(locateHiddenSection(content)?.document).toEqual({
				status: "Done",
			});
		}
	});

	it("does not read a section followed by text", () => {
		const content = `Body\n${OPEN}\n{"status":"Done"}\n</section>\nMore text\n`;
		expect(locateHiddenSection(content)).toBeNull();
	});

	it("does not read a section-shaped string in the body", () => {
		const quoted = `${OPEN}\n{"status":"Done"}\n</section>`;
		const content = `Quote:\n${quoted}\nEnd of note\n${OPEN}\n{"status":"NotStarted"}\n</section>\n`;
		const located = locateHiddenSection(content);
		expect(located?.document).toEqual({ status: "NotStarted" });
		expect(content.slice(0, located?.start)).toContain(quoted);
	});

	it("reads a legacy payload holding an unescaped </section> or opening tag", () => {
		const content = `Body\n${OPEN}\n${JSON.stringify({ a: "</section>", b: OPEN })}\n</section>\n`;
		expect(locateHiddenSection(content)?.document).toEqual({
			a: "</section>",
			b: OPEN,
		});
	});

	it("ignores a section whose payload is not a JSON object", () => {
		expect(locateHiddenSection(`${OPEN}\nnot json\n</section>\n`)).toBeNull();
		expect(locateHiddenSection(`${OPEN}\n[1,2]\n</section>\n`)).toBeNull();
	});

	it("escapes [, %, < and # inside strings and reads them back", () => {
		const document = {
			"key [[x]]": "value",
			nested: {
				list: ["[[Fahrer]]", "%% comment %%", "</section>", "#tag"],
				table: [[["a", "b"]], [["c"]]],
			},
			text: "![[embed]] and [md](link) 100% <b>",
		};
		const section = formatHiddenSection(document);
		const json = section.split("\n")[1] ?? "";
		for (const text of ["[[", "%", "<", "#"]) {
			expect(json).not.toContain(text);
		}
		const strings = json.match(/"(?:[^"\\]|\\.)*"/gu) ?? [];
		expect(strings.some((token) => token.includes("["))).toBe(false);
		expect(section.split("\n")).toHaveLength(3);
		expect(locateHiddenSection(`Body\n${section}\n`)?.document).toEqual(
			document,
		);
	});
});
