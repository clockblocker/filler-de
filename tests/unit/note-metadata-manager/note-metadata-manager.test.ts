import { describe, expect, it } from "bun:test";
import { z } from "zod";
import {
	readMetadata,
	stripInternalMetadata,
	upsertMetadata,
} from "../../../src/managers/pure/note-metadata-manager";

const TestSchema = z.object({
	fileType: z.literal("Scroll"),
	status: z.enum(["Done", "NotStarted"]),
});

describe("note-metadata-manager", () => {
	describe("readMetadata", () => {
		it("returns null for content without metadata", () => {
			const content = "Some note content";
			expect(readMetadata(content, TestSchema)).toBeNull();
		});

		it("parses valid metadata", () => {
			const content = `Some content

<section id="textfresser_meta_keep_me_invisible">
{"status":"Done","fileType":"Scroll"}
</section>

`;
			const result = readMetadata(content, TestSchema);
			expect(result).toEqual({ fileType: "Scroll", status: "Done" });
		});

		it("returns null for invalid JSON", () => {
			const content = `<section id="textfresser_meta_keep_me_invisible">
not json
</section>`;
			expect(readMetadata(content, TestSchema)).toBeNull();
		});

		it("returns null for schema mismatch", () => {
			const content = `<section id="textfresser_meta_keep_me_invisible">
{"wrong":"data"}
</section>`;
			expect(readMetadata(content, TestSchema)).toBeNull();
		});

		it("handles metadata with extra whitespace", () => {
			const content = `Content


<section id="textfresser_meta_keep_me_invisible">
  {"status":"NotStarted","fileType":"Scroll"}
</section>


`;
			const result = readMetadata(content, TestSchema);
			expect(result).toEqual({ fileType: "Scroll", status: "NotStarted" });
		});
	});

	describe("upsertMetadata", () => {
		it("adds metadata to content without existing metadata", () => {
			const content = "Some content";
			const transform = upsertMetadata({ fileType: "Scroll", status: "Done" });
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
			const transform = upsertMetadata({ fileType: "Scroll", status: "Done" });
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
			const transform = upsertMetadata({ status: "Done" });
			const result = transform(content);

			expect(result).toContain("Line 1\nLine 2\nLine 3");
		});

		it("adds proper padding", () => {
			const content = "Content";
			const transform = upsertMetadata({ status: "Done" });
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

			const transform = upsertMetadata(metadata);
			const withMeta = transform(original) as string;
			const readBack = readMetadata(withMeta, TestSchema);

			expect(readBack).toEqual(metadata);
		});
	});

	describe("stripInternalMetadata", () => {
		it("removes metadata section from content", () => {
			const content = `Content here


<section id="textfresser_meta_keep_me_invisible">
{"status":"Done"}
</section>
`;
			const transform = stripInternalMetadata();
			const result = transform(content);

			expect(result).not.toContain('<section id="textfresser_meta_keep_me_invisible">');
			expect(result).not.toContain("</section>");
			expect(result).toBe("Content here");
		});

		it("returns original if no metadata", () => {
			const content = "Just content";
			const transform = stripInternalMetadata();
			expect(transform(content)).toBe("Just content");
		});

		it("handles content with padding newlines", () => {
			const padding = "\n".repeat(20);
			const content = `Content${padding}<section id="textfresser_meta_keep_me_invisible">
{"status":"Done"}
</section>
`;
			const transform = stripInternalMetadata();
			const result = transform(content);

			expect(result).toBe("Content");
		});
	});
});
