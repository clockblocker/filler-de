import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
	buildReadme,
	collectExampleBlocks,
} from "../../generate-readme/generate-readme";

test("README examples expose all named blocks used by the template", () => {
	const blocks = collectExampleBlocks();

	expect(blocks.size).toBeGreaterThan(0);
	expect(blocks.has("core-simple-selection")).toBe(true);
	expect(blocks.has("core-simple-lemma")).toBe(true);
	expect(blocks.has("core-idiom-selection")).toBe(true);
	expect(blocks.has("core-lemma-surface-distinction")).toBe(true);
});

test("generated README matches the committed README", () => {
	const generatedReadme = buildReadme();
	const committedReadme = readFileSync(
		new URL("../../README.md", import.meta.url),
		"utf8",
	);

	expect(generatedReadme).toBe(committedReadme);
});
