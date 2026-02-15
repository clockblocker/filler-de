import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { z } from "zod";
import { noteMetadataHelper } from "../../../src/stateless-helpers/note-metadata";
import { stripJsonSection } from "../../../src/stateless-helpers/note-metadata/internal/json-section";

// Mock the global state module
const mockSettings = { hideMetadata: true };
mock.module("../../../src/global-state/global-state", () => ({
	getParsedUserSettings: () => mockSettings,
}));

const TestSchema = z.object({
	fileType: z.literal("Scroll"),
	status: z.enum(["Done", "NotStarted"]),
});

describe("note-metadata-manager", () => {
	describe("readMetadata", () => {
		it("returns null for content without metadata", () => {
			const content = "Some note content";
			expect(noteMetadataHelper.read(content, TestSchema)).toBeNull();
		});

		it("parses valid metadata", () => {
			const content = `Some content

<section id="textfresser_meta_keep_me_invisible">
{"status":"Done","fileType":"Scroll"}
</section>

`;
			const result = noteMetadataHelper.read(content, TestSchema);
			expect(result).toEqual({ fileType: "Scroll", status: "Done" });
		});

		it("returns null for invalid JSON", () => {
			const content = `<section id="textfresser_meta_keep_me_invisible">
not json
</section>`;
			expect(noteMetadataHelper.read(content, TestSchema)).toBeNull();
		});

		it("returns null for schema mismatch", () => {
			const content = `<section id="textfresser_meta_keep_me_invisible">
{"wrong":"data"}
</section>`;
			expect(noteMetadataHelper.read(content, TestSchema)).toBeNull();
		});

		it("handles metadata with extra whitespace", () => {
			const content = `Content


<section id="textfresser_meta_keep_me_invisible">
  {"status":"NotStarted","fileType":"Scroll"}
</section>


`;
			const result = noteMetadataHelper.read(content, TestSchema);
			expect(result).toEqual({ fileType: "Scroll", status: "NotStarted" });
		});
	});

	describe("upsertMetadata", () => {
		it("adds metadata to content without existing metadata", () => {
			const content = "Some content";
			const transform = noteMetadataHelper.upsert({ fileType: "Scroll", status: "Done" });
			const result = transform(content);

			expect(result).toContain("Some content");
			expect(result).toContain('<section id="textfresser_meta_keep_me_invisible">');
			expect(result).toContain('{"fileType":"Scroll","status":"Done"}');
			expect(result).toContain("</section>");
		});

		it("replaces existing metadata", () => {
			const content = `Content

<section id="textfresser_meta_keep_me_invisible">
{"status":"NotStarted","fileType":"Scroll"}
</section>

`;
			const transform = noteMetadataHelper.upsert({ fileType: "Scroll", status: "Done" });
			const result = transform(content) as string;

			// Should have new status
			expect(result).toContain('"status":"Done"');
			// Should NOT have old status
			expect(result).not.toContain('"status":"NotStarted"');
			// Should have exactly one metadata section
			expect(result.match(/<section/g)?.length).toBe(1);
		});

		it("preserves content before metadata", () => {
			const content = "Line 1\nLine 2\nLine 3";
			const transform = noteMetadataHelper.upsert({ status: "Done" });
			const result = transform(content);

			expect(result).toContain("Line 1\nLine 2\nLine 3");
		});

		it("adds proper padding", () => {
			const content = "Content";
			const transform = noteMetadataHelper.upsert({ status: "Done" });
			const result = transform(content);

			// Should have 20 newlines before metadata to push it below visible area
			expect(result).toMatch(/Content\n{20}<section/);
			// Should end with single \n
			expect(result).toMatch(/<\/section>\n$/);
		});
	});

	describe("roundtrip", () => {
		it("upsert then read returns same data", () => {
			const original = "My note content";
			const metadata = { fileType: "Scroll" as const, status: "Done" as const };

			const transform = noteMetadataHelper.upsert(metadata);
			const withMeta = transform(original) as string;
			const readBack = noteMetadataHelper.read(withMeta, TestSchema);

			expect(readBack).toEqual(metadata);
		});
	});

	describe("strip", () => {
		it("removes metadata section from content", () => {
			const content = `Content here


<section id="textfresser_meta_keep_me_invisible">
{"status":"Done"}
</section>
`;
			const result = noteMetadataHelper.strip(content);

			expect(result).not.toContain('<section id="textfresser_meta_keep_me_invisible">');
			expect(result).not.toContain("</section>");
			expect(result).toBe("Content here");
		});

		it("returns original if no metadata", () => {
			const content = "Just content";
			expect(noteMetadataHelper.strip(content)).toBe("Just content");
		});

		it("handles content with padding newlines", () => {
			const padding = "\n".repeat(20);
			const content = `Content${padding}<section id="textfresser_meta_keep_me_invisible">
{"status":"Done"}
</section>
`;
			const result = noteMetadataHelper.strip(content);

			expect(result).toBe("Content");
		});

		it("strips both YAML frontmatter and JSON section", () => {
			const content = `---
title: Test
---
Content here

<section id="textfresser_meta_keep_me_invisible">
{"status":"Done"}
</section>
`;
			const result = noteMetadataHelper.strip(content);

			expect(result).not.toContain("---");
			expect(result).not.toContain('<section id="textfresser_meta_keep_me_invisible">');
			expect(result).toBe("Content here");
		});
	});

	describe("stripJsonSection (internal)", () => {
		it("removes JSON metadata section from content", () => {
			const content = `Content here


<section id="textfresser_meta_keep_me_invisible">
{"status":"Done"}
</section>
`;
			const result = stripJsonSection(content);

			expect(result).not.toContain('<section id="textfresser_meta_keep_me_invisible">');
			expect(result).toBe("Content here");
		});
	});
});
