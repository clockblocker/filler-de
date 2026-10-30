import { describe, expect, it } from "bun:test";
import { scrollSentences } from "../../../src/commanders/classify/scroll-sentences";
import { splitStrInSentenceBlocks } from "../../../src/commanders/librarian/pages/segmenter/block-marker/split-str-in-sentence-blocks";
import { projectMarkdown } from "../../../src/stateless-helpers/markdown-sentences";

describe("projectMarkdown", () => {
	it("keeps the shown text of links and drops what is not read", () => {
		const content =
			"Ein [[Worter/de/Haus#^r-1|Haus]] und [[Garten]]. ^3\nSiehe [hier](https://x.de) ![[Bild.png]]%%geheim%% ==gut==[^1].";
		const projection = projectMarkdown(content, 0, content.length);
		// The line break becomes a hard break; dumgen's reader drops `[^1]`.
		expect(projection.text).toBe(
			"Ein Haus und Garten.  \nSiehe hier  gut[^1].",
		);
		for (const [index, offset] of projection.offsets.entries())
			if (projection.text[index] !== " ")
				expect(content[offset]).toBe(projection.text[index]);
	});
});

describe("hard breaks", () => {
	it("keep CRLF wraps and backslash breaks as dumgen reads them", () => {
		const texts = (content: string) =>
			scrollSentences(content).sentences.map(({ text }) => text);
		expect(texts("Der Mann ging\r\nnach Hause.")).toEqual([
			"Der Mann ging nach Hause.",
		]);
		expect(texts("Rosen sind rot\\\nVeilchen sind blau")).toEqual([
			"Rosen sind rot",
			"Veilchen sind blau",
		]);
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
		expect(splitStrInSentenceBlocks(content).markedText).toBe(
			[
				"Rosen sind rot ^0",
				"",
				"Veilchen sind blau ^1",
				"",
				"Zucker ist süß ^2",
				"",
				"und du bist es auch ^3",
				"",
				"",
				"",
				"Er kam spät",
				"nach Hause. ^4",
				"",
				"Sie schlief[^1]. ^5",
				"",
				"[^1]: Eine Fußnote.",
			].join("\n"),
		);
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
