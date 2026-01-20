import { describe, expect, it } from "bun:test";
import { calculateSmartRange } from "../../../../src/managers/obsidian/select-all-interceptor/range-calculator";

describe("calculateSmartRange", () => {
	describe("empty content", () => {
		it("returns (0, 0) for empty string", () => {
			const result = calculateSmartRange("");
			expect(result).toEqual({ from: 0, to: 0 });
		});
	});

	describe("plain content", () => {
		it("returns full range for plain text", () => {
			const content = "Hello world";
			const result = calculateSmartRange(content);
			expect(result).toEqual({ from: 0, to: content.length });
		});

		it("returns full range for multiline text", () => {
			const content = "Line 1\nLine 2\nLine 3";
			const result = calculateSmartRange(content);
			expect(result).toEqual({ from: 0, to: content.length });
		});
	});

	describe("frontmatter", () => {
		it("excludes YAML frontmatter", () => {
			const content = "---\ntitle: Test\n---\nActual content";
			const result = calculateSmartRange(content);
			// After frontmatter: "\nActual content"
			// Trimmed leading whitespace: "Actual content"
			const expectedFrom = content.indexOf("Actual");
			const expectedTo = content.length;
			expect(result).toEqual({ from: expectedFrom, to: expectedTo });
		});

		it("handles frontmatter only", () => {
			const content = "---\ntitle: Test\n---\n";
			const result = calculateSmartRange(content);
			// Only whitespace after frontmatter
			expect(result).toEqual({ from: 0, to: 0 });
		});
	});

	describe("go-back links", () => {
		it("excludes go-back link at start", () => {
			const content = "[[__-L4-L3-L2-L1|← L4]]\nActual content";
			const result = calculateSmartRange(content);
			const expectedFrom = content.indexOf("Actual");
			expect(result).toEqual({ from: expectedFrom, to: content.length });
		});

		it("excludes go-back link with custom delimiter", () => {
			const content = "[[__ ;; Book ;; Chapter|← Book]]\nActual content";
			const result = calculateSmartRange(content);
			const expectedFrom = content.indexOf("Actual");
			expect(result).toEqual({ from: expectedFrom, to: content.length });
		});

		it("does not exclude regular links", () => {
			const content = "[[Some Link]]\nActual content";
			const result = calculateSmartRange(content);
			expect(result).toEqual({ from: 0, to: content.length });
		});
	});

	describe("metadata section", () => {
		it("excludes metadata section at end", () => {
			const content =
				'Actual content\n\n\n<section id="textfresser_meta_keep_me_invisible">\n{"key":"value"}\n</section>\n';
			const result = calculateSmartRange(content);
			const expectedTo = "Actual content".length;
			expect(result).toEqual({ from: 0, to: expectedTo });
		});
	});

	describe("combined exclusions", () => {
		it("excludes frontmatter and go-back link", () => {
			const content =
				"---\ntitle: Test\n---\n[[__-L4-L3|← L4]]\nActual content";
			const result = calculateSmartRange(content);
			const expectedFrom = content.indexOf("Actual");
			expect(result).toEqual({ from: expectedFrom, to: content.length });
		});

		it("excludes frontmatter, go-back link, and metadata", () => {
			const content =
				'---\ntitle: Test\n---\n[[__-L4-L3|← L4]]\nActual content\n\n\n<section id="textfresser_meta_keep_me_invisible">\n{"key":"value"}\n</section>\n';
			const result = calculateSmartRange(content);
			const expectedFrom = content.indexOf("Actual");
			const expectedTo = content.indexOf("Actual") + "Actual content".length;
			expect(result).toEqual({ from: expectedFrom, to: expectedTo });
		});

		it("excludes go-back link and metadata", () => {
			const content =
				'[[__-L4-L3|← L4]]\nActual content\n\n\n<section id="textfresser_meta_keep_me_invisible">\n{"key":"value"}\n</section>\n';
			const result = calculateSmartRange(content);
			const expectedFrom = content.indexOf("Actual");
			const expectedTo = content.indexOf("Actual") + "Actual content".length;
			expect(result).toEqual({ from: expectedFrom, to: expectedTo });
		});
	});

	describe("edge cases", () => {
		it("handles content with only go-back link", () => {
			const content = "[[__-L4-L3|← L4]]\n";
			const result = calculateSmartRange(content);
			expect(result).toEqual({ from: 0, to: 0 });
		});

		it("handles content with only metadata", () => {
			const content =
				'<section id="textfresser_meta_keep_me_invisible">\n{"key":"value"}\n</section>\n';
			const result = calculateSmartRange(content);
			expect(result).toEqual({ from: 0, to: 0 });
		});
	});
});
