import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { segmentContent } from "../../../../src/commanders/librarian/bookkeeper/segmenter";
import { DEFAULT_SEGMENTATION_CONFIG } from "../../../../src/commanders/librarian/bookkeeper/types";
import type { SeparatedSuffixedBasename } from "../../../../src/commanders/librarian/codecs/internal/suffix/types";
import { LOG_DIR } from "../../../tracing/consts";
import { ASCHENPUTTEL_CONTENT } from "./testcases/aschenputtel";

const OUTPUT_DIR = join(LOG_DIR, "aschenputtel-split");

describe("Aschenputtel page split", () => {
	const mockBasename: SeparatedSuffixedBasename = {
		coreName: "Aschenputtel",
		suffixParts: ["Märchen"],
	};

	test("split ASCHENPUTTEL_CONTENT into pages", () => {
		const result = segmentContent(
			ASCHENPUTTEL_CONTENT,
			mockBasename,
			DEFAULT_SEGMENTATION_CONFIG,
		);

		if (!existsSync(OUTPUT_DIR)) {
			mkdirSync(OUTPUT_DIR, { recursive: true });
		}

		for (const page of result.pages) {
			writeFileSync(
				join(OUTPUT_DIR, `page-${page.pageIndex}.log`),
				page.content,
				"utf-8",
			);
		}

		expect(result.pages.length).toBeGreaterThan(0);
	});
});
