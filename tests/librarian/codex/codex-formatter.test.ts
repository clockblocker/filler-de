import { describe, expect, it } from "bun:test";
import { CodexFormatter } from "../../../src/commanders/librarian/codex/codex-formatter";
import type { CodexContent } from "../../../src/commanders/librarian/codex/types";
import { TextStatus } from "../../../src/types/common-interface/enums";

describe("CodexFormatter", () => {
	const formatter = new CodexFormatter();

	describe("format - section type", () => {
		it("should format back link", () => {
			const content: CodexContent = {
				backLink: {
					displayName: "Library",
					target: "Library",
				},
				items: [],
			};

			const result = formatter.format(content);

			expect(result).toContain("[[Library|← Library]] ");
		});

		it("should omit back link when null", () => {
			const content: CodexContent = {
				backLink: null,
				items: [],
			};

			const result = formatter.format(content);

			expect(result).not.toContain("[[");
		});

		it("should format nested items with checkboxes", () => {
			const content: CodexContent = {
				backLink: null,
				items: [
					{
						children: [
							{
								children: [],
								displayName: "Episode 1",
								status: TextStatus.Done,
								target: "__Episode_1-Season_1",
							},
						],
						displayName: "Season 1",
						status: TextStatus.NotStarted,
						target: "__Season_1-Avatar",
					},
				],
			};

			const result = formatter.format(content);

			expect(result).toContain("- [ ] [[__Season_1-Avatar|Season 1]] ");
			expect(result).toContain("\t- [x] [[__Episode_1-Season_1|Episode 1]] ");
		});

		it("should use [x] for Done status", () => {
			const content: CodexContent = {
				backLink: null,
				items: [
					{
						children: [],
						displayName: "Done Item",
						status: TextStatus.Done,
						target: "target",
					},
				],
			};

			const result = formatter.format(content);

			expect(result).toContain("[x]");
		});

		it("should use [ ] for NotStarted status", () => {
			const content: CodexContent = {
				backLink: null,
				items: [
					{
						children: [],
						displayName: "Not Started",
						status: TextStatus.NotStarted,
						target: "target",
					},
				],
			};

			const result = formatter.format(content);

			expect(result).toContain("[ ]");
		});

		it("should use [ ] for InProgress status", () => {
			const content: CodexContent = {
				backLink: null,
				items: [
					{
						children: [],
						displayName: "In Progress",
						status: TextStatus.InProgress,
						target: "target",
					},
				],
			};

			const result = formatter.format(content);

			expect(result).toContain("[ ]");
		});
	});

	describe("format - book type", () => {
		it("should format flat page list", () => {
			const content: CodexContent = {
				backLink: {
					displayName: "Season 1",
					target: "__Season_1-Avatar",
				},
				items: [
					{
						children: [],
						displayName: "Page 1",
						status: TextStatus.Done,
						target: "000-Episode_1-Season_1-Avatar",
					},
					{
						children: [],
						displayName: "Page 2",
						status: TextStatus.NotStarted,
						target: "001-Episode_1-Season_1-Avatar",
					},
				],
			};

			const result = formatter.format(content);

			expect(result).toContain("[[__Season_1-Avatar|← Season 1]] ");
			expect(result).toContain("- [x] [[000-Episode_1-Season_1-Avatar|Page 1]] ");
			expect(result).toContain("- [ ] [[001-Episode_1-Season_1-Avatar|Page 2]] ");
			// Book pages are flat (no nesting)
			expect(result).not.toContain("\t-");
		});
	});

	describe("format - full example", () => {
		it("should produce correct Library Codex", () => {
			const content: CodexContent = {
				backLink: null,
				items: [
					{
						children: [
							{
								children: [
									{
										children: [],
										displayName: "Episode 1",
										status: TextStatus.Done,
										target: "__Episode_1-Season_1-Avatar",
									},
								],
								displayName: "Season 1",
								status: TextStatus.Done,
								target: "__Season_1-Avatar",
							},
						],
						displayName: "Avatar",
						status: TextStatus.Done,
						target: "__Avatar",
					},
				],
			};

			const result = formatter.format(content);

			const lines = result.split("\n");
			expect(lines[0]).toBe("");
			expect(lines[1]).toBe("- [x] [[__Avatar|Avatar]] ");
			expect(lines[2]).toBe("\t- [x] [[__Season_1-Avatar|Season 1]] ");
			expect(lines[3]).toBe("\t\t- [x] [[__Episode_1-Season_1-Avatar|Episode 1]] ");
		});
	});
});

