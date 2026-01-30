import { describe, expect, it } from "bun:test";
import {
	frontmatterToInternal,
	internalToFrontmatter,
	parseFrontmatter,
	stripFrontmatter,
} from "../../../src/stateless-helpers/note-metadata/internal/frontmatter";
import { migrateFrontmatter } from "../../../src/stateless-helpers/note-metadata/internal/migration";

describe("frontmatter", () => {
	describe("parseFrontmatter", () => {
		it("returns null for content without frontmatter", () => {
			const content = "Some note content";
			expect(parseFrontmatter(content)).toBeNull();
		});

		it("returns null for frontmatter not at start", () => {
			const content = `Some content
---
title: Test
---`;
			expect(parseFrontmatter(content)).toBeNull();
		});

		it("parses simple key-value pairs", () => {
			const content = `---
title: My Note
status: done
---
Content here`;
			const result = parseFrontmatter(content);
			expect(result).toEqual({ status: "done", title: "My Note" });
		});

		it("parses numbers", () => {
			const content = `---
count: 42
rating: 4.5
negative: -10
---`;
			const result = parseFrontmatter(content);
			expect(result).toEqual({ count: 42, negative: -10, rating: 4.5 });
		});

		it("parses booleans", () => {
			const content = `---
enabled: true
disabled: false
---`;
			const result = parseFrontmatter(content);
			expect(result).toEqual({ disabled: false, enabled: true });
		});

		it("parses inline arrays", () => {
			const content = `---
tags: [one, two, three]
---`;
			const result = parseFrontmatter(content);
			expect(result).toEqual({ tags: ["one", "two", "three"] });
		});

		it("parses multiline arrays", () => {
			const content = `---
tags:
  - first
  - second
  - third
---`;
			const result = parseFrontmatter(content);
			expect(result).toEqual({ tags: ["first", "second", "third"] });
		});

		it("parses quoted strings", () => {
			const content = `---
title: "Hello World"
note: 'Single quoted'
---`;
			const result = parseFrontmatter(content);
			expect(result).toEqual({
				note: "Single quoted",
				title: "Hello World",
			});
		});

		it("parses date-like strings", () => {
			const content = `---
created: 2023-04-18
modified: 2023-04-18 11:14
---`;
			const result = parseFrontmatter(content);
			expect(result).toEqual({
				created: "2023-04-18",
				modified: "2023-04-18 11:14",
			});
		});

		it("handles null values", () => {
			const content = `---
empty: null
tilde: ~
---`;
			const result = parseFrontmatter(content);
			expect(result).toEqual({ empty: null, tilde: null });
		});

		it("skips comments", () => {
			const content = `---
# This is a comment
title: Test
# Another comment
---`;
			const result = parseFrontmatter(content);
			expect(result).toEqual({ title: "Test" });
		});

		it("returns null for empty frontmatter", () => {
			const content = `---
---
Content`;
			expect(parseFrontmatter(content)).toBeNull();
		});

		it("handles Windows line endings", () => {
			const content = "---\r\ntitle: Test\r\n---\r\nContent";
			const result = parseFrontmatter(content);
			expect(result).toEqual({ title: "Test" });
		});
	});

	describe("stripFrontmatter", () => {
		it("removes frontmatter from start", () => {
			const content = `---
title: Test
---
Content here`;
			expect(stripFrontmatter(content)).toBe("Content here");
		});

		it("returns original if no frontmatter", () => {
			const content = "Just content";
			expect(stripFrontmatter(content)).toBe("Just content");
		});

		it("handles empty content after frontmatter", () => {
			const content = `---
title: Test
---
`;
			expect(stripFrontmatter(content)).toBe("");
		});
	});

	describe("frontmatterToInternal", () => {
		it("maps status: done to Done", () => {
			const result = frontmatterToInternal({ status: "done" });
			expect(result.status).toBe("Done");
		});

		it("maps status: Done to Done", () => {
			const result = frontmatterToInternal({ status: "Done" });
			expect(result.status).toBe("Done");
		});

		it("maps status: completed to Done", () => {
			const result = frontmatterToInternal({ status: "completed" });
			expect(result.status).toBe("Done");
		});

		it("maps status: true to Done", () => {
			const result = frontmatterToInternal({ status: true });
			expect(result.status).toBe("Done");
		});

		it("maps unknown status to NotStarted", () => {
			const result = frontmatterToInternal({ status: "in progress" });
			expect(result.status).toBe("NotStarted");
		});

		it("defaults to NotStarted when no status", () => {
			const result = frontmatterToInternal({ title: "Test" });
			expect(result.status).toBe("NotStarted");
		});

		it("spreads all fields directly", () => {
			const fm = {
				created: "2023-04-18",
				tags: ["a", "b"],
				title: "My Note",
			};
			const result = frontmatterToInternal(fm);
			expect(result.title).toBe("My Note");
			expect(result.created).toBe("2023-04-18");
			expect(result.tags).toEqual(["a", "b"]);
		});

		it("uses completion field as fallback", () => {
			const result = frontmatterToInternal({ completion: "done" });
			expect(result.status).toBe("Done");
		});
	});

	describe("migrateFrontmatter", () => {
		it("converts frontmatter to internal format", () => {
			const content = `---
title: Test
status: done
---
Content here`;
			const transform = migrateFrontmatter();
			const result = transform(content);

			// Should not contain YAML frontmatter
			expect(result).not.toContain("---");
			// Should contain internal metadata section
			expect(result).toContain('<section id="textfresser_meta_keep_me_invisible">');
			// Should contain Done status
			expect(result).toContain('"status":"Done"');
			// Should contain title directly (not in "imported")
			expect(result).toContain('"title":"Test"');
			expect(result).not.toContain('"imported"');
			// Should preserve content
			expect(result).toContain("Content here");
		});

		it("returns original if no frontmatter", () => {
			const content = "Just content";
			const transform = migrateFrontmatter();
			expect(transform(content)).toBe("Just content");
		});

		it("handles content with only frontmatter", () => {
			const content = `---
title: Only Meta
---
`;
			const transform = migrateFrontmatter();
			const result = transform(content);

			expect(result).not.toContain("---");
			expect(result).toContain('<section id="textfresser_meta_keep_me_invisible">');
		});

		it("keeps YAML when stripYaml is false", () => {
			const content = `---
title: Test
status: done
---
Content here`;
			const transform = migrateFrontmatter({ stripYaml: false });
			const result = transform(content);

			// Should keep YAML frontmatter
			expect(result).toContain("---");
			expect(result).toContain("title: Test");
			// Should also have internal metadata section
			expect(result).toContain('<section id="textfresser_meta_keep_me_invisible">');
			expect(result).toContain('"status":"Done"');
			// Should preserve content
			expect(result).toContain("Content here");
		});

		it("strips YAML when stripYaml is true (explicit)", () => {
			const content = `---
title: Test
---
Content`;
			const transform = migrateFrontmatter({ stripYaml: true });
			const result = transform(content);

			expect(result).not.toContain("---");
			expect(result).toContain('<section id="textfresser_meta_keep_me_invisible">');
		});
	});

	describe("internalToFrontmatter", () => {
		it("converts Done status to checkbox true", () => {
			const result = internalToFrontmatter({ status: "Done" });
			expect(result).toBe("---\nstatus: true\n---");
		});

		it("converts NotStarted status to checkbox false", () => {
			const result = internalToFrontmatter({ status: "NotStarted" });
			expect(result).toBe("---\nstatus: false\n---");
		});

		it("converts multiple fields", () => {
			const result = internalToFrontmatter({
				count: 42,
				status: "NotStarted",
				title: "My Note",
			});
			expect(result).toContain("---\n");
			expect(result).toContain("status: false");
			expect(result).toContain("title: My Note");
			expect(result).toContain("count: 42");
			expect(result).toMatch(/---$/);
		});

		it("handles arrays", () => {
			const result = internalToFrontmatter({
				status: "Done",
				tags: ["one", "two"],
			});
			expect(result).toContain("tags: [one, two]");
		});

		it("quotes strings with special characters", () => {
			const result = internalToFrontmatter({
				status: "Done",
				title: "Hello: World",
			});
			expect(result).toContain('title: "Hello: World"');
		});

		it("handles booleans", () => {
			const result = internalToFrontmatter({
				disabled: false,
				enabled: true,
				status: "Done",
			});
			expect(result).toContain("enabled: true");
			expect(result).toContain("disabled: false");
		});

		it("skips null and undefined values", () => {
			const result = internalToFrontmatter({
				empty: null,
				missing: undefined,
				status: "Done",
			});
			expect(result).not.toContain("empty");
			expect(result).not.toContain("missing");
		});

		it("roundtrips with frontmatterToInternal", () => {
			const original = {
				count: 5,
				status: "Done" as const,
				title: "Test",
			};
			const yaml = internalToFrontmatter(original);
			const parsed = parseFrontmatter(yaml + "\nContent");
			const converted = frontmatterToInternal(parsed!);

			expect(converted.status).toBe("Done");
			expect(converted.title).toBe("Test");
			expect(converted.count).toBe(5);
		});
	});
});
