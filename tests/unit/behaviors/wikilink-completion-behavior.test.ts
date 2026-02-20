import { describe, expect, it } from "bun:test";
import type { EditorView } from "@codemirror/view";
import { createWikilinkCompletionHandler } from "../../../src/managers/obsidian/behavior-manager/wikilink-complition-behavior";
import type { WikilinkPayload } from "../../../src/managers/obsidian/user-event-interceptor/events/wikilink/payload";

type WikilinkLibrarian = Parameters<typeof createWikilinkCompletionHandler>[0];

function makePayload(linkContent: string): WikilinkPayload {
	return {
		closePos: linkContent.length,
		kind: "WikilinkCompleted",
		linkContent,
		view: {} as EditorView,
	};
}

function makeContext() {
	const app = {
		metadataCache: {
			getFirstLinkpathDest: () => null,
		},
		workspace: {
			getActiveFile: () => ({ path: "Books/lesson.md" }),
		},
	};

	return {
		app,
		vam: {},
	};
}

describe("wikilink completion behavior", () => {
	it("passes through when corename lookup is ambiguous", () => {
		const librarian = {
			findMatchingLeavesByCoreName: () => [
				{ basename: "die-pronoun-de", pathParts: ["Library", "de", "pronoun"] },
				{ basename: "die-article-de", pathParts: ["Library", "de", "article"] },
			],
			resolveWikilinkAlias: () => null,
		} as unknown as WikilinkLibrarian;

		const handler = createWikilinkCompletionHandler(librarian);
		const result = handler.handle(makePayload("die"), makeContext());
		expect(result).toEqual({ outcome: "Passthrough" });
	});

	it("keeps single-match auto-resolution behavior", () => {
		const librarian = {
			findMatchingLeavesByCoreName: () => [
				{ basename: "die-pronoun-de", pathParts: ["Library", "de", "pronoun"] },
			],
			resolveWikilinkAlias: () => null,
		} as unknown as WikilinkLibrarian;

		const handler = createWikilinkCompletionHandler(librarian);
		const result = handler.handle(makePayload("die"), makeContext());

		expect(result).toEqual({
			data: {
				aliasToInsert: "die",
				closePos: 3,
				kind: "WikilinkCompleted",
				linkContent: "die",
				resolvedTarget: "die-pronoun-de",
				view: expect.any(Object),
			},
			outcome: "Modified",
		});
	});
});
