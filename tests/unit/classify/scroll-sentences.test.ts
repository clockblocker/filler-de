import { describe, expect, it } from "bun:test";
import {
	projectScrollMarkdown,
	scrollSentences,
} from "../../../src/commanders/classify/scroll-sentences";
import { splitPlainText } from "../../../src/stateless-helpers/dumgen-sentences";

describe("projectScrollMarkdown", () => {
	it("keeps the shown text of links and drops what is not read", () => {
		const content =
			"Ein [[Worter/de/Haus#^r-1|Haus]] und [[Garten]]. ^3\nSiehe [hier](https://x.de) ![[Bild.png]]%%geheim%% ==gut==[^1].";
		const projection = projectScrollMarkdown(content, 0, content.length);
		// The line break becomes a hard break; dumgen's reader drops `[^1]`.
		expect(projection.text).toBe(
			"Ein Haus und Garten.  \nSiehe hier  gut[^1].",
		);
		for (const [index, offset] of projection.offsets.entries())
			if (projection.text[index] !== " ")
				expect(content[offset]).toBe(projection.text[index]);
	});
});

describe("Classify and the ^N block formatter", () => {
	it("split verse, prose and footnotes into the same Sentences", () => {
		const content = [
			"Rosen sind rot",
			"Veilchen sind blau",
			"Zucker ist süß",
			"und du bist es auch",
			"",
			"Er kam spät",
			"nach Hause. Sie schlief[^1].",
			"",
			"[^1]: Eine Fußnote.",
		].join("\n");
		expect(scrollSentences(content).sentences.map(({ text }) => text)).toEqual(
			[
				"Rosen sind rot",
				"Veilchen sind blau",
				"Zucker ist süß",
				"und du bist es auch",
				"Er kam spät nach Hause.",
				"Sie schlief.",
			],
		);
		expect(
			splitPlainText(content.slice(0, content.indexOf("[^1]:"))).flat(),
		).toEqual([
			"Rosen sind rot",
			"Veilchen sind blau",
			"Zucker ist süß",
			"und du bist es auch",
			"Er kam spät nach Hause.",
			"Sie schlief[^1].",
		]);
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
