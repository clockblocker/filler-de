import { describe, expect, it } from "bun:test";
import { type BodySegment, type RenderedBlock, readBody, sealOf } from "../src";

const blocks: RenderedBlock[] = [
	{ block: "header", lines: ["🏭 das Kohlekraftwerk"] },
	{
		block: "attestation",
		lines: ["Deine Kontexte", "![[Atom#^13|^]]", "", "![[Atom#^14|^]]"],
	},
	{ block: "translation", lines: ["Übersetzung", "coal-fired power plant"] },
];
const seals = blocks.map(sealOf);
const body = `${blocks[0]?.lines.join("\n")}\n\n${blocks[1]?.lines.join("\n")}\n${blocks[2]?.lines.join("\n")}\n`;

const shape = (segments: readonly BodySegment[]) =>
	segments.map((segment) =>
		segment.type === "rendering"
			? segment.block
			: `freeform:${segment.text}`,
	);

describe("the rendering boundary", () => {
	it("seals a rendering as its line count and an 8-digit SHA-256 of its lines", () => {
		expect(sealOf({ block: "x", lines: ["a", "b"] })).toEqual({
			block: "x",
			hash: "7e18f737",
			lines: 2,
		});
	});

	it("matches every sealed rendering, blank lines inside one included", () => {
		expect(shape(readBody(body, seals))).toEqual([
			"header",
			"attestation",
			"translation",
		]);
	});

	it("reads a line typed under a rendering as freeform, the rendering intact", () => {
		const typed = body.replace(
			"coal-fired power plant\n",
			"coal-fired power plant\nmy own gloss\n",
		);
		expect(shape(readBody(typed, seals))).toEqual([
			"header",
			"attestation",
			"translation",
			"freeform:my own gloss",
		]);
	});

	it("reads an edited rendering as freeform, byte for byte, never as the rendering", () => {
		const edited = body.replace("![[Atom#^14|^]]", "![[Atom#^15|^]]");
		expect(shape(readBody(edited, seals))).toEqual([
			"header",
			"freeform:Deine Kontexte\n![[Atom#^13|^]]\n\n![[Atom#^15|^]]",
			"translation",
		]);
	});

	it("still matches a section the user moved", () => {
		const moved = `${blocks[2]?.lines.join("\n")}\n\n${blocks[0]?.lines.join("\n")}\n\n${blocks[1]?.lines.join("\n")}\n`;
		expect(shape(readBody(moved, seals))).toEqual([
			"translation",
			"header",
			"attestation",
		]);
	});

	it("keeps freeform bytes: trailing spaces, CRLF and inner blank lines", () => {
		const user = "  indented  \r\n\r\n\tafter a gap\r";
		const text = `${body}\n${user}\n`;
		const freeform = readBody(text, seals).filter(
			(segment) => segment.type === "freeform",
		);
		expect(freeform).toMatchObject([
			{ text: "  indented  \r\n\r\n\tafter a gap" },
		]);
	});

	it("matches renderings in a CRLF file", () => {
		expect(shape(readBody(body.replaceAll("\n", "\r\n"), seals))).toEqual([
			"header",
			"attestation",
			"translation",
		]);
	});

	it("matches two identical renderings once each", () => {
		const twice = [
			{ block: "a", lines: ["same"] },
			{ block: "b", lines: ["same"] },
		];
		expect(
			shape(readBody("same\nsame\nsame\n", twice.map(sealOf))),
		).toEqual(["a", "b", "freeform:same"]);
	});

	it("gives every segment its line range", () => {
		const typed = `${body}\nmine\n`;
		const last = readBody(typed, seals).at(-1);
		expect(last).toMatchObject({ end: 10, start: 9, type: "freeform" });
		expect(typed.split("\n")[9]).toBe("mine");
	});

	it("reads a body without seals as freeform alone", () => {
		expect(shape(readBody("\n\nonly text\n\n", []))).toEqual([
			"freeform:only text",
		]);
	});
});
