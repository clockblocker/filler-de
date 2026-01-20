import { describe, expect, test } from "bun:test";
import { splitStrInBlocks } from "../../../../src/commanders/librarian/bookkeeper/segmenter/block-marker";
import { EXTRA_E2_FULL_CONTENT } from "./testcases/extra-e2";

describe("EXTRA_E2 page segmentation investigation", () => {
	test("block splitting produces correct output", () => {
		const result = splitStrInBlocks(EXTRA_E2_FULL_CONTENT);

		console.log("Block count:", result.blockCount);
		console.log("");
		console.log("=== First 3000 chars of marked text ===");
		console.log(result.markedText.slice(0, 3000));
		console.log("");

		// Check that headings are NOT merged with content
		// Every heading should end with ":**" or ":**\n" not ":**<content>"
		const headingsMergedWithContent = result.markedText.match(
			/###### \*\*[A-Z]+:\*\*[^\n]/g,
		);
		console.log(
			"Headings merged with content:",
			headingsMergedWithContent?.length ?? 0,
		);
		if (headingsMergedWithContent) {
			console.log("Examples:", headingsMergedWithContent.slice(0, 5));
		}

		// The test - headings should NOT be merged
		expect(headingsMergedWithContent).toBeNull();
	});

	test("check block count is reasonable", () => {
		const result = splitStrInBlocks(EXTRA_E2_FULL_CONTENT);

		// 326 blocks for dialogue is probably too many
		// Each dialogue turn is 1-3 sentences, so maybe ~100-150 blocks would be reasonable
		console.log("Total blocks:", result.blockCount);

		// This is currently 326 which seems too high
		// But the key is whether the headings are preserved correctly
	});
});
