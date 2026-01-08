import { describe, expect, it } from "bun:test";
import { z } from "zod";
import {
	readMetadata,
	upsertMetadata,
} from "../../../src/managers/pure/note-metadata-manager";

const TestSchema = z.object({
	status: z.enum(["Done", "NotStarted"]),
	fileType: z.literal("Scroll"),
});

describe("note-metadata-manager", () => {
	describe("readMetadata", () => {
		it("returns null for content without metadata", () => {
			const content = "Some note content";
			expect(readMetadata(content, TestSchema)).toBeNull();
		});

		it("parses valid metadata", () => {
			const content = `Some content

<section id={textfresser_meta_keep_me_invisible}>
{"status":"Done","fileType":"Scroll"}
</section>

`;
			const result = readMetadata(content, TestSchema);
			expect(result).toEqual({ status: "Done", fileType: "Scroll" });
		});

		it("returns null for invalid JSON", () => {
			const content = `<section id={textfresser_meta_keep_me_invisible}>
not json
</section>`;
			expect(readMetadata(content, TestSchema)).toBeNull();
		});

		it("returns null for schema mismatch", () => {
			const content = `<section id={textfresser_meta_keep_me_invisible}>
{"wrong":"data"}
</section>`;
			expect(readMetadata(content, TestSchema)).toBeNull();
		});

		it("handles metadata with extra whitespace", () => {
			const content = `Content


<section id={textfresser_meta_keep_me_invisible}>
  {"status":"NotStarted","fileType":"Scroll"}
</section>


`;
			const result = readMetadata(content, TestSchema);
			expect(result).toEqual({ status: "NotStarted", fileType: "Scroll" });
		});
	});

	describe("upsertMetadata", () => {
		it("adds metadata to content without existing metadata", () => {
			const content = "Some content";
			const transform = upsertMetadata({ status: "Done", fileType: "Scroll" });
			const result = transform(content);

			expect(result).toContain("Some content");
			expect(result).toContain("<section id={textfresser_meta_keep_me_invisible}>");
			expect(result).toContain('{"status":"Done","fileType":"Scroll"}');
			expect(result).toContain("</section>");
		});

		it("replaces existing metadata", () => {
			const content = `Content

<section id={textfresser_meta_keep_me_invisible}>
{"status":"NotStarted","fileType":"Scroll"}
</section>

`;
			const transform = upsertMetadata({ status: "Done", fileType: "Scroll" });
			const result = transform(content);

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

			// Should have \n\n before metadata
			expect(result).toMatch(/Content\n\n<section/);
			// Should end with \n\n
			expect(result).toMatch(/<\/section>\n\n$/);
		});
	});

	describe("roundtrip", () => {
		it("upsert then read returns same data", () => {
			const original = "My note content";
			const metadata = { status: "Done" as const, fileType: "Scroll" as const };

			const transform = upsertMetadata(metadata);
			const withMeta = transform(original);
			const readBack = readMetadata(withMeta, TestSchema);

			expect(readBack).toEqual(metadata);
		});
	});
});
