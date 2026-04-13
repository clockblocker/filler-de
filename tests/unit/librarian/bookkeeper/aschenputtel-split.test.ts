import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { segmentContent } from "../../../../src/commanders/librarian/pages/segmenter";
import { DEFAULT_SEGMENTATION_CONFIG } from "../../../../src/commanders/librarian/pages/types";
import type { SeparatedSuffixedBasename } from "@textfresser/library-core";
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
