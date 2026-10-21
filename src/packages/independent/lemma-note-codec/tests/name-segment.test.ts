import { describe, expect, it } from "bun:test";
import {
	FILE_NAME_MAX_BYTES,
	NAME_SEGMENT_FALLBACK,
	NAME_SEGMENT_MAX_BYTES,
	toNameSegment,
} from "../src";
import { randomText, seeded } from "./path-support";

const utf8 = (text: string) => new TextEncoder().encode(text).length;
const graphemes = (text: string) =>
	Array.from(
		new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
			text,
		),
		({ segment }) => segment,
	);

const RESERVED = [
	"CON",
	"PRN",
	"AUX",
	"NUL",
	...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
	...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`),
];

describe("toNameSegment", () => {
	it("1. normalizes to NFC", () => {
		const nfd = "Mütter";
		expect(toNameSegment(nfd)).toBe("Mütter");
		expect(toNameSegment(nfd)).toBe(nfd.normalize("NFC"));
	});

	it("2. drops each forbidden character", () => {
		for (const char of [
			"/",
			"\\",
			":",
			"*",
			"?",
			'"',
			"<",
			">",
			"|",
			"#",
			"^",
			"[",
			"]",
		])
			expect(toNameSegment(`a${char}b`)).toBe("ab");
	});

	it("2. drops control characters, whitespace controls included", () => {
		for (const char of [
			"\u0000",
			"\u0007",
			"\u001f",
			"\u007f",
			"\u0085",
			"\u009f",
			"\t",
			"\n",
			"\r",
		])
			expect(toNameSegment(`a${char}b`)).toBe("ab");
	});

	it("2. normalizes again after a drop joins a base and its combining mark", () => {
		expect(toNameSegment("e#́")).toBe("é");
	});

	it("3. collapses each run of whitespace to one space", () => {
		expect(toNameSegment("a  b")).toBe("a b");
		expect(toNameSegment("a   b")).toBe("a b");
		expect(toNameSegment("a　 b")).toBe("a b");
		expect(toNameSegment("a # b")).toBe("a b");
	});

	it("4. trims leading and trailing spaces and dots", () => {
		expect(toNameSegment(" a ")).toBe("a");
		expect(toNameSegment("..a..")).toBe("a");
		expect(toNameSegment(". a .")).toBe("a");
		expect(toNameSegment(".hidden")).toBe("hidden");
		expect(toNameSegment("z.B.")).toBe("z.B");
		expect(toNameSegment("a . b")).toBe("a . b");
	});

	it("5. prefixes every Windows reserved base name with @, in any case", () => {
		for (const name of RESERVED) {
			expect(toNameSegment(name)).toBe(`@${name}`);
			expect(toNameSegment(name.toLowerCase())).toBe(
				`@${name.toLowerCase()}`,
			);
			expect(toNameSegment(`${name}.txt`)).toBe(`@${name}.txt`);
		}
		expect(toNameSegment("Con")).toBe("@Con");
		expect(toNameSegment("con.tar.gz")).toBe("@con.tar.gz");
		expect(toNameSegment("CON.")).toBe("@CON");
	});

	it("5. leaves names that only look reserved", () => {
		for (const name of [
			"COM0",
			"COM10",
			"LPT",
			"CONx",
			"Konsole",
			"aCON",
			"@CON",
			"CON x",
			"x.CON",
		])
			expect(toNameSegment(name)).toBe(name);
	});

	it("6. caps a segment at 255 UTF-8 bytes", () => {
		expect(toNameSegment("a".repeat(300))).toBe("a".repeat(255));
		const umlauts = toNameSegment("ü".repeat(200));
		expect(umlauts).toBe("ü".repeat(127));
		expect(utf8(umlauts)).toBe(254);
	});

	it("6. cuts only at a grapheme boundary", () => {
		const family = "👨‍👩‍👧";
		const capped = toNameSegment(family.repeat(30));
		expect(utf8(capped)).toBeLessThanOrEqual(NAME_SEGMENT_MAX_BYTES);
		expect(graphemes(capped).every((grapheme) => grapheme === family)).toBe(
			true,
		);
		expect(utf8(capped) + utf8(family)).toBeGreaterThan(
			NAME_SEGMENT_MAX_BYTES,
		);
		const flag = toNameSegment(`${"a".repeat(253)}🇩🇪`);
		expect(flag).toBe("a".repeat(253));
	});

	it("6. trims what a cut leaves at the end", () => {
		expect(toNameSegment(`${"a".repeat(254)} b`)).toBe("a".repeat(254));
		expect(toNameSegment(`${"a".repeat(253)}..b`)).toBe("a".repeat(253));
	});

	it("6. takes a smaller cap for a file name, which keeps .md within 255 bytes", () => {
		expect(FILE_NAME_MAX_BYTES).toBe(252);
		expect(toNameSegment("a".repeat(300), FILE_NAME_MAX_BYTES)).toBe(
			"a".repeat(252),
		);
	});

	it("7. falls back to @ when nothing is left", () => {
		for (const spelling of ["", " ", "...", "???", "#[]", ". .", "\u0000"])
			expect(toNameSegment(spelling)).toBe(NAME_SEGMENT_FALLBACK);
		expect(toNameSegment("@")).toBe("@");
	});

	it("never converts ß, ẞ or umlauts", () => {
		for (const spelling of [
			"Maße",
			"MAẞE",
			"Größe",
			"Bestätigung",
			"Übermut",
		])
			expect(toNameSegment(spelling)).toBe(spelling);
	});

	it("keeps leading punctuation, digits and symbols it doesn't drop", () => {
		for (const spelling of [
			"…",
			"'s",
			"-chen",
			"3D",
			"§ 5",
			"€",
			"+1",
			"~",
			"_",
		])
			expect(toNameSegment(spelling)).toBe(spelling);
	});

	it("is idempotent, and always yields a legal segment", () => {
		const alphabet = [
			"a",
			"Z",
			"ß",
			"ẞ",
			"ü",
			"ü",
			"́",
			"e",
			" ",
			"  ",
			" ",
			"\t",
			".",
			"..",
			"#",
			"?",
			"/",
			"[",
			"]",
			"^",
			"|",
			":",
			"*",
			'"',
			"<",
			">",
			"\\",
			"\u0000",
			"\u007f",
			"CON",
			"con",
			"LPT1",
			"aux.",
			"@",
			"🚗",
			"👨‍👩‍👧",
			"🇩🇪",
			"🖱️",
			"∅",
			"…",
			"-",
			"'",
			"~",
			"_",
			"+",
			"%",
			"‍",
			"️",
			"한",
			"가",
			"ﬁ",
			"İ",
			"ı",
		];
		const random = seeded(111);
		for (let run = 0; run < 3000; run++) {
			const spelling = randomText(
				random,
				alphabet,
				run % 10 === 0 ? 120 : 12,
			);
			const segment = toNameSegment(spelling);
			expect(toNameSegment(segment)).toBe(segment);
			expect(segment).toBe(segment.normalize("NFC"));
			expect(segment.length).toBeGreaterThan(0);
			expect(utf8(segment)).toBeLessThanOrEqual(NAME_SEGMENT_MAX_BYTES);
			expect(segment).not.toMatch(
				/[/\\:*?"<>|#^[\]\p{Cc}]|\s\s|[^\S ]|^[ .]|[ .]$/u,
			);
			const capped = toNameSegment(spelling, FILE_NAME_MAX_BYTES);
			expect(toNameSegment(capped, FILE_NAME_MAX_BYTES)).toBe(capped);
		}
	});
});
