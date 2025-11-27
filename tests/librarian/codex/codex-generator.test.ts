import { describe, expect, it } from "bun:test";
import { CodexGenerator } from "../../../src/commanders/librarian/codex/codex-generator";
import type {
	PageNode,
	SectionNode,
	TextNode,
} from "../../../src/commanders/librarian/types";
import { NodeType } from "../../../src/commanders/librarian/types";
import { TextStatus } from "../../../src/types/common-interface/enums";

describe("CodexGenerator", () => {
	const generator = new CodexGenerator();

	describe("forSection", () => {
		it("should generate back link to parent codex", () => {
			const parent: SectionNode = {
				children: [],
				name: "Library",
				parent: null,
				status: TextStatus.NotStarted,
				type: NodeType.Section,
			};

			const section: SectionNode = {
				children: [],
				name: "Avatar",
				parent: parent,
				status: TextStatus.NotStarted,
				type: NodeType.Section,
			};
			parent.children.push(section);

			const content = generator.forSection(section);

			expect(content.backLink).not.toBeNull();
			expect(content.backLink?.displayName).toBe("Library");
			expect(content.backLink?.target).toBe("__Library");
		});

		it("should return null backLink for root", () => {
			const root: SectionNode = {
				children: [],
				name: "Library",
				parent: null,
				status: TextStatus.NotStarted,
				type: NodeType.Section,
			};

			const content = generator.forSection(root);

			expect(content.backLink).toBeNull();
		});

		it("should generate items for children", () => {
			const parent: SectionNode = {
				children: [],
				name: "Library",
				parent: null,
				status: TextStatus.NotStarted,
				type: NodeType.Section,
			};

			const textNode: TextNode = {
				children: [
					{
						name: "Episode_1",
						parent: null, // Will set below
						status: TextStatus.Done,
						type: NodeType.Page,
					} as PageNode,
				],
				name: "Episode_1",
				parent: parent,
				status: TextStatus.Done,
				type: NodeType.Text,
			};
			textNode.children[0]!.parent = textNode;

			parent.children.push(textNode);

			const content = generator.forSection(parent);

			expect(content.items.length).toBe(1);
			expect(content.items?.[0]?.displayName).toBe("Episode 1");
			expect(content.items?.[0]?.status).toBe(TextStatus.Done);
		});

		it("should generate nested items for section children", () => {
			const root: SectionNode = {
				children: [],
				name: "Library",
				parent: null,
				status: TextStatus.NotStarted,
				type: NodeType.Section,
			};

			const section: SectionNode = {
				children: [],
				name: "Avatar",
				parent: root,
				status: TextStatus.NotStarted,
				type: NodeType.Section,
			};

			const text: TextNode = {
				children: [
					{
						name: "000",
						parent: null,
						status: TextStatus.NotStarted,
						type: NodeType.Page,
					} as PageNode,
				],
				name: "Episode_1",
				parent: section,
				status: TextStatus.NotStarted,
				type: NodeType.Text,
			};
			text.children[0]!.parent = text;

			section.children.push(text);
			root.children.push(section);

			const content = generator.forSection(root);

			expect(content.items.length).toBe(1);
			expect(content.items?.[0]?.displayName).toBe("Avatar");
			expect(content.items?.[0]?.children.length).toBe(1);
			expect(content.items?.[0]?.children?.[0]?.displayName).toBe("Episode 1");
		});
	});

	describe("forBook", () => {
		it("should generate flat page items", () => {
			const parent: SectionNode = {
				children: [],
				name: "Season_1",
				parent: null,
				status: TextStatus.NotStarted,
				type: NodeType.Section,
			};

			const book: TextNode = {
				children: [
					{
						name: "000",
						parent: null,
						status: TextStatus.Done,
						type: NodeType.Page,
					} as PageNode,
					{
						name: "001",
						parent: null,
						status: TextStatus.NotStarted,
						type: NodeType.Page,
					} as PageNode,
				],
				name: "Episode_1",
				parent: parent,
				status: TextStatus.NotStarted,
				type: NodeType.Text,
			};
			book.children[0]!.parent = book;
			book.children[1]!.parent = book;

			const content = generator.forBook(book);

			expect(content.items.length).toBe(2);
			expect(content.items?.[0]?.displayName).toBe("Page 1");
			expect(content.items?.[0]?.status).toBe(TextStatus.Done);
			expect(content.items?.[1]?.displayName).toBe("Page 2");
			expect(content.items?.[1]?.status).toBe(TextStatus.NotStarted);
		});
	});

	describe("forNode", () => {
		it("should return null for scrolls", () => {
			const scroll: TextNode = {
				children: [
					{
						name: "000",
						parent: null,
						status: TextStatus.NotStarted,
						type: NodeType.Page,
					} as PageNode,
				],
				name: "Song",
				parent: null,
				status: TextStatus.NotStarted,
				type: NodeType.Text,
			};

			const content = generator.forNode(scroll);

			expect(content).toBeNull();
		});

		it("should return content for books", () => {
			const book: TextNode = {
				children: [
					{
						name: "000",
						parent: null,
						status: TextStatus.Done,
						type: NodeType.Page,
					} as PageNode,
					{
						name: "001",
						parent: null,
						status: TextStatus.NotStarted,
						type: NodeType.Page,
					} as PageNode,
				],
				name: "Episode",
				parent: null,
				status: TextStatus.NotStarted,
				type: NodeType.Text,
			};

			const content = generator.forNode(book);

			expect(content).not.toBeNull();
			expect(content?.items.length).toBe(2);
		});
	});

	describe("hasCodex", () => {
		it("should return true for section nodes", () => {
			const section: SectionNode = {
				children: [],
				name: "Test",
				parent: null,
				status: TextStatus.NotStarted,
				type: NodeType.Section,
			};

			expect(generator.hasCodex(section)).toBe(true);
		});

		it("should return true for multi-page texts (books)", () => {
			const book: TextNode = {
				children: [
					{ name: "000", parent: null, status: TextStatus.Done, type: NodeType.Page } as PageNode,
					{ name: "001", parent: null, status: TextStatus.Done, type: NodeType.Page } as PageNode,
				],
				name: "Book",
				parent: null,
				status: TextStatus.Done,
				type: NodeType.Text,
			};

			expect(generator.hasCodex(book)).toBe(true);
		});

		it("should return false for scrolls", () => {
			const scroll: TextNode = {
				children: [
					{ name: "000", parent: null, status: TextStatus.Done, type: NodeType.Page } as PageNode,
				],
				name: "Scroll",
				parent: null,
				status: TextStatus.Done,
				type: NodeType.Text,
			};

			expect(generator.hasCodex(scroll)).toBe(false);
		});
	});
});

