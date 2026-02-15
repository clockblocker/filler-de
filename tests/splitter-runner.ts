import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join, parse } from "path";
import { segmentContent } from "../src/commanders/librarian/bookkeeper/segmenter";
import { splitStrInBlocks } from "../src/commanders/librarian/bookkeeper/segmenter/block-marker/split-str-in-blocks";
import { DEFAULT_LANGUAGE_CONFIG } from "../src/commanders/librarian/bookkeeper/segmenter/language-config";
import { DEFAULT_SEGMENTATION_CONFIG } from "../src/commanders/librarian/bookkeeper/types";

const INPUT_DIR = "tests/texts_to_split";
const OUTPUT_DIR = "tests/splitter-logs";

/**
 * Strip go-back links from content start (inline version for standalone script).
 * Pattern: [[__...]] at start of content
 */
function stripGoBackLinks(content: string): string {
	const pattern = /^\s*\[\[__[^\n\r]*?\]\]\s*/;
	let result = content;
	while (pattern.test(result)) {
		result = result.replace(pattern, "").trimStart();
	}
	return result;
}

function run() {
	const blocksDir = join(OUTPUT_DIR, "split_in_blocks");
	const pagesDir = join(OUTPUT_DIR, "split_in_pages");
	mkdirSync(blocksDir, { recursive: true });
	mkdirSync(pagesDir, { recursive: true });

	const files = readdirSync(INPUT_DIR).filter((f) => f.endsWith(".md"));

	if (files.length === 0) {
		console.log("No .md files found in", INPUT_DIR);
		return;
	}

	for (const file of files) {
		const rawContent = readFileSync(join(INPUT_DIR, file), "utf-8");
		const name = parse(file).name;

		// Strip go-back links before processing
		const content = stripGoBackLinks(rawContent);

		// Split in blocks
		const blockResult = splitStrInBlocks(content);
		writeFileSync(join(blocksDir, file), blockResult.markedText);
		console.log(`[blocks] ${name}: ${blockResult.blockCount} blocks`);

		// Split in pages
		// NodeName is just a branded string - we pass raw string since validation
		// depends on global state which isn't available in this standalone script
		const pageResult = segmentContent(
			content,
			{ coreName: name as any, suffixParts: [] },
			DEFAULT_SEGMENTATION_CONFIG,
			DEFAULT_LANGUAGE_CONFIG,
		);

		const pageOutDir = join(pagesDir, name);
		mkdirSync(pageOutDir, { recursive: true });

		for (const page of pageResult.pages) {
			const pageFile = `page_${String(page.pageIndex + 1).padStart(3, "0")}.md`;
			// Also add block markers to each page
			const pageWithBlocks = splitStrInBlocks(page.content);
			writeFileSync(join(pageOutDir, pageFile), pageWithBlocks.markedText);
		}
		console.log(
			`[pages] ${name}: ${pageResult.pages.length} pages (tooShort: ${pageResult.tooShortToSplit})`,
		);
	}

	console.log("\nDone. Results in:", OUTPUT_DIR);
}

run();
