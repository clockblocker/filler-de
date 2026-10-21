import { describe, expect, it } from "bun:test";
import { serialize } from "../src";
import { foreignData, mutter, nounData, verbData } from "./fixtures";
import { issueTags, parseDe } from "./helpers";

const noun = serialize(undefined, nounData);
const identityLine =
	noun.split("\n").find((line) => line.startsWith("%%tf:identity")) ?? "";
const firstReading = /%%tf-part:reading (r-[0-9a-f]+)%%/u.exec(noun)?.[1] ?? "";

/** The note with the first line that starts with `prefix` replaced. */
function replaceLine(markdown: string, prefix: string, line: string): string {
	const lines = markdown.split("\n");
	const index = lines.findIndex((current) => current.startsWith(prefix));
	if (index === -1) throw new Error(`No line starts with ${prefix}`);
	lines[index] = line;
	return lines.join("\n");
}

describe("hand-edited notes come back as typed issues", () => {
	it("a note without an identity Block", () => {
		expect(issueTags(noun.replace(`${identityLine}\n\n`, ""))).toEqual([
			"MissingRequiredBlock",
		]);
	});

	it("a note without a Lemma part", () => {
		expect(issueTags(noun.replace("%%tf-part:lemma%%\n", ""))).toContain(
			"MissingRequiredBlock",
		);
		expect(issueTags("")).toEqual(["MissingRequiredBlock"]);
		expect(issueTags("Just some text\n")).toEqual(["MissingRequiredBlock"]);
	});

	it("never takes the Lemma from the path, header, tags or Block IDs", () => {
		const withoutIdentity = noun.replace(`${identityLine}\n\n`, "");
		expect(withoutIdentity).toContain("👩 die [[");
		const { data } = parseDe(withoutIdentity);
		expect(data.ok).toBe(false);
		if (!data.ok) {
			expect(data.partial.lemmaRecord).toBeUndefined();
			expect(data.partial.readingEntries).toEqual([]);
		}
	});

	it("a duplicate identity Block", () => {
		expect(
			issueTags(
				noun.replace(
					identityLine,
					`${identityLine}\n\n${identityLine}`,
				),
			),
		).toEqual(["DuplicateBlock"]);
	});

	it("a second Lemma part", () => {
		expect(
			issueTags(`${noun}\n%%tf-part:lemma%%\n\n${identityLine}\n`),
		).toEqual(["DuplicatePart"]);
	});

	it("a duplicate Block in a Reading part", () => {
		const translation =
			noun
				.split("\n")
				.find((line) => line.startsWith("%%tf:translation")) ?? "";
		expect(
			issueTags(
				noun.replace(translation, `${translation}\n\n${translation}`),
			),
		).toEqual(["DuplicateBlock"]);
	});

	it("a payload that is not JSON", () => {
		expect(
			issueTags(
				replaceLine(
					noun,
					"%%tf:identity",
					'%%tf:identity {"canonicalForm":%%',
				),
			),
		).toEqual(["InvalidBlockPayload"]);
		expect(
			issueTags(
				replaceLine(noun, "%%tf:translation", "%%tf:translation%%"),
			),
		).toEqual(["InvalidBlockPayload"]);
	});

	it("a payload dumdict rejects", () => {
		const badLemma = identityLine.replace(
			'"gender":"Fem"',
			'"gender":"Femme"',
		);
		const { data } = parseDe(noun.replace(identityLine, badLemma));
		expect(data.ok).toBe(false);
		if (!data.ok) {
			expect(data.issues[0]).toMatchObject({
				_tag: "InvalidRecord",
				at: { partIndex: 0, scope: "lemma" },
				record: "LemmaRecord",
			});
			expect(
				data.issues[0]?._tag === "InvalidRecord" &&
					data.issues[0].issues.length,
			).toBeGreaterThan(0);
		}
		expect(
			issueTags(
				replaceLine(
					noun,
					"%%tf:attestation",
					"%%tf:attestation [1,2]%%",
				),
			),
		).toEqual(["InvalidRecord"]);
		expect(
			issueTags(
				replaceLine(
					noun,
					"%%tf:pending_relation",
					'%%tf:pending_relation [{"relation":"cousin"}]%%',
				),
			),
		).toEqual(["InvalidRecord"]);
		expect(
			issueTags(
				replaceLine(
					noun,
					"%%tf:pending_relation",
					'%%tf:pending_relation {"relation":"antonym"}%%',
				),
			),
		).toEqual(["InvalidBlockPayload"]);
	});

	it("a null payload, which parse never repairs", () => {
		expect(
			issueTags(
				replaceLine(
					noun,
					"%%tf:attestation",
					"%%tf:attestation null%%",
				),
			),
		).toEqual(["InvalidRecord"]);
		expect(
			issueTags(replaceLine(noun, "%%tf:notes@", "%%tf:notes null%%")),
		).toEqual(["InvalidRecord"]);
	});

	it("a stored inverse relation", () => {
		const inverse = `%%tf:relation {"hyponym":[${JSON.stringify(mutter)}],"targetKind":"lemma"}%%`;
		expect(issueTags(replaceLine(noun, "%%tf:relation", inverse))).toEqual([
			"InvalidRecord",
		]);
	});

	it("a Reading part without its reading Block", () => {
		expect(issueTags(replaceLine(noun, '%%tf:reading "🔩"', ""))).toEqual([
			"MissingRequiredBlock",
		]);
	});

	it("a Foreign Reading with an Emoji Description, or a second one", () => {
		const foreign = serialize(undefined, foreignData);
		const part =
			/%%tf-part:reading r-[0-9a-f]+%%/u.exec(foreign)?.[0] ?? "";
		expect(
			issueTags(foreign.replace(part, `${part}\n\n%%tf:reading "🙂"%%`)),
		).toEqual(["InconsistentRecord"]);
		const second = foreign.slice(foreign.indexOf(part));
		expect(issueTags(`${foreign}\n${second}`)).toContain(
			"InconsistentRecord",
		);
	});

	it("two parts holding one Reading", () => {
		const verb = serialize(undefined, verbData);
		const part = verb.slice(verb.indexOf("%%tf-part:reading"));
		expect(issueTags(`${verb}\n${part}`)).toEqual(["InconsistentRecord"]);
	});

	it("an owned Surface of another Lemma", () => {
		const surfaceLine =
			noun.split("\n").find((line) => line.startsWith("%%tf:surface")) ??
			"";
		const foreignSurface = surfaceLine
			.replaceAll('"canonicalForm":"Mutter"', '"canonicalForm":"Vater"')
			.replace('"gender":"Fem"', '"gender":"Masc"');
		const { data } = parseDe(noun.replace(surfaceLine, foreignSurface));
		expect(!data.ok && data.issues).toEqual([
			expect.objectContaining({
				_tag: "InvalidRecord",
				at: expect.objectContaining({ scope: "surface" }),
				record: "SurfaceEntry",
			}),
		]);
	});

	it("a Block ID that does not match its part's identity", () => {
		expect(
			issueTags(
				noun.replace(
					`%%tf-part:reading ${firstReading}%%`,
					"%%tf-part:reading r-00000000%%",
				),
			),
		).toEqual(["BlockIdMismatch"]);
		const { data } = parseDe(
			noun.replace(
				`%%tf-part:reading ${firstReading}%%`,
				"%%tf-part:reading%%",
			),
		);
		expect(!data.ok && data.issues[0]).toMatchObject({
			_tag: "BlockIdMismatch",
			expected: firstReading,
			found: undefined,
		});
	});

	it("a typed Block outside its scope or before the first part", () => {
		expect(
			issueTags(
				noun.replace(
					"%%tf-part:surface",
					`${identityLine}\n\n%%tf-part:surface`,
				),
			),
		).toEqual(["MisplacedBlock"]);
		expect(issueTags(`%%tf:tags%%\n#x\n\n${noun}`)).toEqual([
			"MisplacedBlock",
		]);
	});

	it("keeps unknown Blocks without reporting them", () => {
		const parsed = parseDe(
			`${noun}\n%%tf:someday {"a":1}%%\n%%tf-part:chapter%%\n`,
		);
		expect(parsed.data.ok).toBe(true);
		const lastPart = parsed.document.parts.at(-1);
		expect(
			lastPart?.blocks.filter((block) => block.type === "unknown"),
		).toHaveLength(2);
	});

	it("never throws on arbitrary edits", () => {
		const lines = noun.split("\n");
		let seed = 7;
		const random = () => {
			seed = (seed * 1103515245 + 12345) % 2 ** 31;
			return seed / 2 ** 31;
		};
		for (let round = 0; round < 300; round++) {
			const edited = [...lines];
			const index = Math.floor(random() * edited.length);
			const line = edited[index] ?? "";
			const cut = Math.floor(random() * (line.length + 1));
			edited[index] =
				random() < 0.5
					? line.slice(0, cut) +
						line.slice(cut + 1 + Math.floor(random() * 5))
					: `${line.slice(0, cut)}${'{}[]",:%~x0'[Math.floor(random() * 12)] ?? ""}${line.slice(cut)}`;
			expect(() => parseDe(edited.join("\n"))).not.toThrow();
		}
	});
});
