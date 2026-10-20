import { describe, expect, it } from "bun:test";
import {
	projectScrollMarkdown,
	scrollSentences,
} from "../../../src/commanders/classify/scroll-sentences";

describe("projectScrollMarkdown", () => {
	it("keeps the shown text of links and drops what is not read", () => {
		const content =
			"Ein [[Worter/de/Haus#^r-1|Haus]] und [[Garten]]. ^3\nSiehe [hier](https://x.de) ![[Bild.png]]%%geheim%% ==gut==[^1].";
		const projection = projectScrollMarkdown(content, 0, content.length);
		expect(projection.text).toBe(
			"Ein Haus und Garten.\nSiehe hier  gut.",
		);
		for (const [index, offset] of projection.offsets.entries())
			expect(content[offset]).toBe(projection.text[index]);
	});
});

describe("scrollSentences", () => {
	it("splits the body with dumgen's reader and places each Sentence in the editor's offsets", () => {
		const content = [
			"---",
			"tags: [buch]",
			"---",
			"## Kapitel *eins*",
			"",
			"- Er kam **spät** nach",
			"  Hause. Sie schlief. ^0",
		].join("\n");
		const { sentences } = scrollSentences(content);
		expect(sentences.map(({ text }) => text)).toEqual([
			"Kapitel eins",
			"Er kam spät nach Hause.",
			"Sie schlief.",
		]);
		expect(
			sentences.map(({ source }) => content.slice(source.from, source.to)),
		).toEqual([
			"Kapitel *eins",
			"Er kam **spät** nach\n  Hause.",
			"Sie schlief.",
		]);
	});
});
