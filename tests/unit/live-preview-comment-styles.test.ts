import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

describe("Live Preview comment styles", () => {
	test("hides comment tokens on inactive Live Preview lines only", () => {
		expect(styles).toContain(
			[
				".markdown-source-view.mod-cm6.is-live-preview",
				"\t.cm-line:not(.cm-active):not(.HyperMD-codeblock)",
				"\t.cm-comment:not(.cm-hmd-codeblock):not(.cm-hmd-frontmatter):not(.cm-math) {",
				"\tdisplay: none;",
				"}",
			].join("\n"),
		);
	});
});
