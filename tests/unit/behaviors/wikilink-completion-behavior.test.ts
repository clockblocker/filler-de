import { describe, expect, it } from "bun:test";
import { createWikilinkCompletionHandler } from "../../../src/managers/obsidian/behavior-manager/wikilink-complition-behavior";
import {
	type WikilinkPayload,
	UserEventKind,
} from "../../../src/managers/obsidian/user-event-interceptor";

type WikilinkLibrarian = Parameters<typeof createWikilinkCompletionHandler>[0];

function makePayload(linkContent: string): WikilinkPayload {
	return {
		canResolveNatively: false,
		kind: UserEventKind.WikilinkCompleted,
		linkContent,
		sourcePath: "Books/lesson.md",
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
		const result = handler.handle(makePayload("die"));
		expect(result).toEqual({ outcome: "passthrough" });
	});

	it("keeps single-match auto-resolution behavior", () => {
		const librarian = {
			findMatchingLeavesByCoreName: () => [
				{ basename: "die-pronoun-de", pathParts: ["Library", "de", "pronoun"] },
			],
			resolveWikilinkAlias: () => null,
		} as unknown as WikilinkLibrarian;

		const handler = createWikilinkCompletionHandler(librarian);
		const result = handler.handle(makePayload("die"));

		expect(result).toEqual({
			effect: {
				aliasToInsert: "die",
				resolvedTarget: "die-pronoun-de",
			},
			outcome: "effect",
		});
	});
});
