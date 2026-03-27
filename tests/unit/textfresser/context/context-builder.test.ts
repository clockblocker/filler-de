import { describe, expect, it } from "bun:test";
import { buildAttestationFromWikilinkClickPayload } from "../../../../src/commanders/textfresser/common/attestation/builders/build-from-wikilink-click-payload";
import {
	type PayloadFor,
	UserEventKind,
} from "@textfresser/obsidian-event-layer";

const makePayload = (
	basename: string,
	blockContent: string,
	target: { basename: string; alias?: string },
): PayloadFor<"WikilinkClicked"> => ({
	blockContent,
	kind: UserEventKind.WikilinkClicked,
	sourcePath: `${basename}.md`,
	target,
});

describe("buildAttestationFromWikilinkClickPayload", () => {
	describe("State 1: [[schönen]] without block ID", () => {
		it("returns correct attestation", () => {
			const input = makePayload("Note", "Text with [[schönen]] here", {
				basename: "schönen",
			});
			const result = buildAttestationFromWikilinkClickPayload(input);

			expect(result.isOk()).toBe(true);
			const att = result._unsafeUnwrap();
			expect(att.source.textRaw).toBe("Text with [[schönen]] here");
			expect(att.target.surface).toBe("schönen");
			expect(att.target.lemma).toBeUndefined();
			// No block ID, so ref equals raw block content
			expect(att.source.ref).toBe("Text with [[schönen]] here");
			expect(att.source.textWithOnlyTargetMarked).toBe(
				"Text with [schönen] here",
			);
		});
	});

	describe("State 2: [[schönen]] with block ID", () => {
		it("returns formatted ref with block embed", () => {
			const input = makePayload("Note", "Text with [[schönen]] here ^6", {
				basename: "schönen",
			});
			const result = buildAttestationFromWikilinkClickPayload(input);

			expect(result.isOk()).toBe(true);
			const att = result._unsafeUnwrap();
			expect(att.source.textRaw).toBe("Text with [[schönen]] here ^6");
			expect(att.target.surface).toBe("schönen");
			expect(att.source.ref).toBe("![[Note#^6|^]]");
			expect(att.source.textWithOnlyTargetMarked).toBe(
				"Text with [schönen] here",
			);
		});

		it("handles alphanumeric block ID", () => {
			const input = makePayload("MyNote", "Text [[word]] ^abc-123", {
				basename: "word",
			});
			const result = buildAttestationFromWikilinkClickPayload(input);

			expect(result.isOk()).toBe(true);
			const att = result._unsafeUnwrap();
			expect(att.source.ref).toBe("![[MyNote#^abc-123|^]]");
		});
	});

	describe("State 3: [[schön|schönen]] without block ID", () => {
		it("returns alias as surface, basename as lemma", () => {
			const input = makePayload("Note", "Text with [[schön|schönen]] here", {
				alias: "schönen",
				basename: "schön",
			});
			const result = buildAttestationFromWikilinkClickPayload(input);

			expect(result.isOk()).toBe(true);
			const att = result._unsafeUnwrap();
			expect(att.source.textRaw).toBe("Text with [[schön|schönen]] here");
			expect(att.target.surface).toBe("schönen");
			expect(att.target.lemma).toBe("schön");
			// No block ID, ref equals raw
			expect(att.source.ref).toBe("Text with [[schön|schönen]] here");
			expect(att.source.textWithOnlyTargetMarked).toBe(
				"Text with [schönen] here",
			);
		});
	});

	describe("State 4: [[schön|schönen]] with block ID", () => {
		it("returns formatted ref with block embed and alias as surface", () => {
			const input = makePayload("Note", "Text with [[schön|schönen]] here ^6", {
				alias: "schönen",
				basename: "schön",
			});
			const result = buildAttestationFromWikilinkClickPayload(input);

			expect(result.isOk()).toBe(true);
			const att = result._unsafeUnwrap();
			expect(att.source.textRaw).toBe("Text with [[schön|schönen]] here ^6");
			expect(att.target.surface).toBe("schönen");
			expect(att.target.lemma).toBe("schön");
			expect(att.source.ref).toBe("![[Note#^6|^]]");
			expect(att.source.textWithOnlyTargetMarked).toBe(
				"Text with [schönen] here",
			);
		});
	});

	describe("Edge cases", () => {
		it("handles bold text in block content", () => {
			const input = makePayload("Note", "**Bold** text with [[word]] ^1", {
				basename: "word",
			});
			const result = buildAttestationFromWikilinkClickPayload(input);

			expect(result.isOk()).toBe(true);
			const att = result._unsafeUnwrap();
			expect(att.source.textWithOnlyTargetMarked).toBe(
				"Bold text with [word]",
			);
		});

		it("handles German umlauts correctly", () => {
			const input = makePayload("Übung", "Text [[über|überall]] ^2", {
				alias: "überall",
				basename: "über",
			});
			const result = buildAttestationFromWikilinkClickPayload(input);

			expect(result.isOk()).toBe(true);
			const att = result._unsafeUnwrap();
			expect(att.target.surface).toBe("überall");
			expect(att.target.lemma).toBe("über");
			expect(att.source.ref).toBe("![[Übung#^2|^]]");
		});
	});
});
