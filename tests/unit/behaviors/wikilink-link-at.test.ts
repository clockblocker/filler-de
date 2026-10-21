import { describe, expect, it } from "bun:test";
import { completedLinkAt } from "../../../src/packages/composed/obsidian-event-layer/src/events/wikilink/link-at";

/** The link whose `]]` is the last one in `text`. */
const at = (text: string) => completedLinkAt(text, text.lastIndexOf("]]"));

describe("completedLinkAt", () => {
	it("reads a bare link, its content span and its close", () => {
		const text = "Der [[Fahrer]] fährt.";
		expect(at(text)).toEqual({
			closePos: 12,
			contentFrom: 6,
			embed: false,
			linkContent: "Fahrer",
		});
	});

	it("trims the content but spans its padding, so a rewrite replaces it", () => {
		const text = "[[ Fahrer ]]";
		const link = at(text);
		expect(link?.linkContent).toBe("Fahrer");
		expect(text.slice(link?.contentFrom, link?.closePos)).toBe(" Fahrer ");
	});

	it("tells an embed", () => {
		expect(at("![[Fahrer]]")?.embed).toBe(true);
	});

	it("skips links with an alias, links across lines and empty links", () => {
		expect(at("[[Fahrer|der Fahrer]]")).toBeNull();
		expect(at("[[Der\nFahrer]]")).toBeNull();
		expect(at("[[  ]]")).toBeNull();
		expect(at("Fahrer]]")).toBeNull();
	});
});
