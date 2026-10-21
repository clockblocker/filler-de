import { describe, expect, it } from "bun:test";
import type { LeafMatch } from "@textfresser/library-core";
import {
	type PayloadFor,
	UserEventKind,
} from "@textfresser/obsidian-event-layer";
import { createWikilinkCompletionHandler } from "../../../src/managers/obsidian/behavior-manager/wikilink-complition-behavior";

type WikilinkLibrarian = Parameters<typeof createWikilinkCompletionHandler>[0];

function makePayload(
	linkContent: string,
	overrides: Partial<PayloadFor<"WikilinkCompleted">> = {},
): PayloadFor<"WikilinkCompleted"> {
	return {
		embed: false,
		kind: UserEventKind.WikilinkCompleted,
		linkContent,
		sourcePath: "Books/lesson.md",
		...overrides,
	};
}

/** A Librarian with these leaves by core name, and suffix aliases for names with `-`. */
function librarianWith(
	leaves: Record<string, LeafMatch[]> = {},
): WikilinkLibrarian {
	return {
		findMatchingLeavesByCoreName: (coreName: string) =>
			leaves[coreName] ?? [],
		resolveWikilinkAlias: (linkContent: string) => {
			const [coreName, ...suffix] = linkContent.split("-");
			return suffix.length > 0 ? (coreName ?? null) : null;
		},
	} as unknown as WikilinkLibrarian;
}

const handle = (
	linkContent: string,
	overrides: Partial<PayloadFor<"WikilinkCompleted">> = {},
	librarian: WikilinkLibrarian = librarianWith(),
) =>
	createWikilinkCompletionHandler(librarian).handle(
		makePayload(linkContent, overrides),
	);

const landsOn = (target: string, alias: string) =>
	({
		effect: { aliasToInsert: alias, resolvedTarget: target },
		outcome: "effect",
	}) as const;

describe("wikilink completion behavior: Library rules", () => {
	it("passes through when corename lookup is ambiguous", () => {
		const librarian = librarianWith({
			die: [
				{ basename: "die-pronoun-de", pathParts: ["Library", "de", "pronoun"] },
				{ basename: "die-article-de", pathParts: ["Library", "de", "article"] },
			] as LeafMatch[],
		});
		expect(handle("die", {}, librarian)).toEqual({ outcome: "passthrough" });
	});

	it("keeps single-match auto-resolution behavior", () => {
		const librarian = librarianWith({
			die: [
				{ basename: "die-pronoun-de", pathParts: ["Library", "de", "pronoun"] },
			] as LeafMatch[],
		});
		expect(handle("die", {}, librarian)).toEqual(
			landsOn("die-pronoun-de", "die"),
		);
	});

	it("keeps the suffix alias of a link to a Library note", () => {
		expect(
			handle("Aschenputtel-Märchen", {
				resolvedPath: "Library/Märchen/Aschenputtel-Märchen.md",
			}),
		).toEqual({ effect: { aliasToInsert: "Aschenputtel" }, outcome: "effect" });
	});

	it("leaves a word that resolves to a note outside Worter/ alone", () => {
		expect(
			handle("Einkaufsliste", { resolvedPath: "Notes/Einkaufsliste.md" }),
		).toEqual({ outcome: "passthrough" });
	});
});

describe("wikilink completion behavior: Crossroad landing (#115)", () => {
	it("lands a bare word on its Crossroad path, which need not exist yet", () => {
		expect(handle("Fahrer")).toEqual(
			landsOn("Worter/f/fah/fahre/fahrer", "Fahrer"),
		);
	});

	it("lands a word Obsidian resolves into Worter/ on its Crossroad path", () => {
		// A Crossroad note, or a stray Obsidian made for an earlier click.
		for (const resolvedPath of [
			"Worter/f/fah/fahre/fahrer.md",
			"Worter/Fahrer.md",
			"Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/Fahrer.md",
		])
			expect(handle("Fahrer", { resolvedPath })).toEqual(
				landsOn("Worter/f/fah/fahre/fahrer", "Fahrer"),
			);
	});

	it("keeps the user's spelling as the alias and folds only the path", () => {
		expect(handle("Maße")).toEqual(landsOn("Worter/m/maß/maße/maße", "Maße"));
		expect(handle("sich in Acht nehmen")).toEqual(
			landsOn("Worter/s/sic/sichi/sich in acht nehmen", "sich in Acht nehmen"),
		);
	});

	it("lands a hyphenated word on its Crossroad rather than taking a suffix alias", () => {
		expect(handle("E-Mail")).toEqual(landsOn("Worter/e/e-m/e-mai/e-mail", "E-Mail"));
	});

	it("leaves links with a path, a heading or block, or an extension to the Library rules", () => {
		for (const linkContent of [
			"Worter/f/fah/fahre/fahrer",
			"Notes/Fahrer",
			"Fahrer#Bedeutung",
			"Fahrer#^abc",
			"#Heading",
			"Fahrer.md",
		])
			expect(handle(linkContent)).toEqual({ outcome: "passthrough" });
	});

	it("leaves an embed alone", () => {
		expect(handle("Fahrer", { embed: true })).toEqual({
			outcome: "passthrough",
		});
	});

	it("leaves links typed in Worter/ notes, or without a source note, alone", () => {
		expect(
			handle("Fahrer", {
				sourcePath: "Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/🚗 Fahrer.md",
			}),
		).toEqual({ outcome: "passthrough" });
		expect(handle("Fahrer", { sourcePath: undefined })).toEqual({
			outcome: "passthrough",
		});
	});

	it("lets a Library leaf of that core name win", () => {
		const librarian = librarianWith({
			Aschenputtel: [
				{
					basename: "Aschenputtel-Märchen",
					pathParts: ["Library", "Märchen"],
				},
			] as LeafMatch[],
		});
		expect(handle("Aschenputtel", {}, librarian)).toEqual(
			landsOn("Aschenputtel-Märchen", "Aschenputtel"),
		);
	});

	it("leaves a spelling with no Crossroad path alone", () => {
		expect(handle("...")).toEqual({ outcome: "passthrough" });
	});
});
