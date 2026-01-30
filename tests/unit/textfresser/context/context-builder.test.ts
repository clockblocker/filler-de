import { describe, expect, it } from "bun:test";
import {
	type ContextBuilderInput,
	buildTextfresserContext,
} from "../../../../src/commanders/textfresser/context/context-builder";

describe("buildTextfresserContext", () => {
	describe("State 1: [[schönen]] without block ID", () => {
		it("returns correct context", () => {
			const input: ContextBuilderInput = {
				blockContent: "Text with [[schönen]] here",
				linkTarget: "schönen",
				basename: "Note",
			};
			const result = buildTextfresserContext(input);

			expect(result.isOk()).toBe(true);
			const ctx = result._unsafeUnwrap();
			expect(ctx.rawBlock).toBe("Text with [[schönen]] here");
			expect(ctx.target).toBe("schönen");
			expect(ctx.formattedContext).toBe("Text with [[schönen]] here");
			expect(ctx.contextWithOnlyTargetSurfaceHighlited).toBe(
				"Text with [schönen] here",
			);
			expect(ctx.targetMatchesBaseform).toBe("Unverified");
		});
	});

	describe("State 2: [[schönen]] with block ID", () => {
		it("returns formatted context with block embed", () => {
			const input: ContextBuilderInput = {
				blockContent: "Text with [[schönen]] here ^6",
				linkTarget: "schönen",
				basename: "Note",
			};
			const result = buildTextfresserContext(input);

			expect(result.isOk()).toBe(true);
			const ctx = result._unsafeUnwrap();
			expect(ctx.rawBlock).toBe("Text with [[schönen]] here ^6");
			expect(ctx.target).toBe("schönen");
			expect(ctx.formattedContext).toBe("![[Note#^6|^]]");
			expect(ctx.contextWithOnlyTargetSurfaceHighlited).toBe(
				"Text with [schönen] here",
			);
		});

		it("handles alphanumeric block ID", () => {
			const input: ContextBuilderInput = {
				blockContent: "Text [[word]] ^abc-123",
				linkTarget: "word",
				basename: "MyNote",
			};
			const result = buildTextfresserContext(input);

			expect(result.isOk()).toBe(true);
			const ctx = result._unsafeUnwrap();
			expect(ctx.formattedContext).toBe("![[MyNote#^abc-123|^]]");
		});
	});

	describe("State 3: [[schön|schönen]] without block ID", () => {
		it("returns alias as target", () => {
			const input: ContextBuilderInput = {
				blockContent: "Text with [[schön|schönen]] here",
				linkTarget: "schön",
				basename: "Note",
			};
			const result = buildTextfresserContext(input);

			expect(result.isOk()).toBe(true);
			const ctx = result._unsafeUnwrap();
			expect(ctx.rawBlock).toBe("Text with [[schön|schönen]] here");
			expect(ctx.target).toBe("schönen");
			expect(ctx.formattedContext).toBe("Text with [[schön|schönen]] here");
			expect(ctx.contextWithOnlyTargetSurfaceHighlited).toBe(
				"Text with [schönen] here",
			);
		});
	});

	describe("State 4: [[schön|schönen]] with block ID", () => {
		it("returns formatted context with block embed and alias as target", () => {
			const input: ContextBuilderInput = {
				blockContent: "Text with [[schön|schönen]] here ^6",
				linkTarget: "schön",
				basename: "Note",
			};
			const result = buildTextfresserContext(input);

			expect(result.isOk()).toBe(true);
			const ctx = result._unsafeUnwrap();
			expect(ctx.rawBlock).toBe("Text with [[schön|schönen]] here ^6");
			expect(ctx.target).toBe("schönen");
			expect(ctx.formattedContext).toBe("![[Note#^6|^]]");
			expect(ctx.contextWithOnlyTargetSurfaceHighlited).toBe(
				"Text with [schönen] here",
			);
		});
	});

	describe("Error cases", () => {
		it("returns error when wikilink not found", () => {
			const input: ContextBuilderInput = {
				blockContent: "Text without matching link",
				linkTarget: "schönen",
				basename: "Note",
			};
			const result = buildTextfresserContext(input);

			expect(result.isErr()).toBe(true);
			expect(result._unsafeUnwrapErr()).toEqual({ kind: "WIKILINK_NOT_FOUND" });
		});

		it("returns error when linkTarget doesn't match any wikilink", () => {
			const input: ContextBuilderInput = {
				blockContent: "Text with [[foo]]",
				linkTarget: "bar",
				basename: "Note",
			};
			const result = buildTextfresserContext(input);

			expect(result.isErr()).toBe(true);
			expect(result._unsafeUnwrapErr()).toEqual({ kind: "WIKILINK_NOT_FOUND" });
		});
	});

	describe("Edge cases", () => {
		it("handles multiple wikilinks, finds correct one", () => {
			const input: ContextBuilderInput = {
				blockContent: "[[foo]] text [[bar]] more [[baz]]",
				linkTarget: "bar",
				basename: "Note",
			};
			const result = buildTextfresserContext(input);

			expect(result.isOk()).toBe(true);
			const ctx = result._unsafeUnwrap();
			expect(ctx.target).toBe("bar");
			expect(ctx.contextWithOnlyTargetSurfaceHighlited).toBe(
				"foo text [bar] more baz",
			);
		});

		it("handles bold text in block content", () => {
			const input: ContextBuilderInput = {
				blockContent: "**Bold** text with [[word]] ^1",
				linkTarget: "word",
				basename: "Note",
			};
			const result = buildTextfresserContext(input);

			expect(result.isOk()).toBe(true);
			const ctx = result._unsafeUnwrap();
			expect(ctx.contextWithOnlyTargetSurfaceHighlited).toBe(
				"Bold text with [word]",
			);
		});

		it("handles German umlauts correctly", () => {
			const input: ContextBuilderInput = {
				blockContent: "Text [[über|überall]] ^2",
				linkTarget: "über",
				basename: "Übung",
			};
			const result = buildTextfresserContext(input);

			expect(result.isOk()).toBe(true);
			const ctx = result._unsafeUnwrap();
			expect(ctx.target).toBe("überall");
			expect(ctx.formattedContext).toBe("![[Übung#^2|^]]");
		});
	});
});
