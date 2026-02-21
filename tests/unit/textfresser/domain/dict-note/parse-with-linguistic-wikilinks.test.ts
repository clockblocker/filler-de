import { describe, expect, it } from "bun:test";
import { dictNoteHelper } from "../../../../../src/commanders/textfresser/domain/dict-note";
import type { DictEntry } from "../../../../../src/commanders/textfresser/domain/dict-note/types";
import { cssSuffixFor } from "../../../../../src/commanders/textfresser/targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../../src/commanders/textfresser/targets/de/sections/section-kind";

function section(kind: DictSectionKind, content: string) {
	return {
		content,
		kind: cssSuffixFor[kind],
		title: TitleReprFor[kind].German,
	};
}

function parseLibraryBasename(basename: string) {
	const parts = basename.split("-");
	const coreName = parts[0];
	if (!coreName) return null;
	if (parts.length <= 1) return null;
	return {
		coreName,
		suffixParts: parts.slice(1),
	};
}

describe("dictNoteHelper.parseWithLinguisticWikilinks", () => {
	it("attaches classified linguistic wikilinks from section context", () => {
		const entries: DictEntry[] = [
			{
				headerContent: "wir",
				id: "LX-LM-PRON-1",
				meta: {},
				sections: [
					section(
						DictSectionKind.Attestation,
						"[[wir-personal-pronomen-de|Wir]] arbeiten im Team.",
					),
					section(
						DictSectionKind.Relation,
						"= [[arbeiten]], ≠ [[faulenzen]]",
					),
					section(DictSectionKind.Inflection, "Präteritum: [[aß]]"),
					section(
						DictSectionKind.FreeForm,
						"custom note [[Haus]] from user",
					),
				],
			},
		];
		const serialized = dictNoteHelper.serialize(entries).body;
		const parsed = dictNoteHelper.parseWithLinguisticWikilinks({
			lookupInLibraryByCoreName: (coreName: string) =>
				coreName === "wir"
					? [
							{
								basename: "wir-personal-pronomen-de",
								extension: "md",
								kind: "MdFile",
								pathParts: [
									"Library",
									"de",
									"pronomen",
									"personal",
								],
							},
						]
					: [],
			noteText: serialized,
			parseLibraryBasename,
		});
		const [entry] = parsed;
		expect(entry).toBeDefined();
		const wikilinks = entry?.linguisticWikilinks ?? [];
		expect(wikilinks).toHaveLength(5);

		const attestationWir = wikilinks.find(
			(link) => link.target === "wir-personal-pronomen-de",
		);
		expect(attestationWir?.source).toBe("TextfresserCommand");
		expect(attestationWir?.intent).toBe("LemmaSemanticAttestation");
		expect(attestationWir?.targetKind).toBe("Surface");
		expect(attestationWir?.targetRef.kind).toBe("LibraryLeaf");
		if (attestationWir?.targetRef.kind === "LibraryLeaf") {
			expect(attestationWir.targetRef.coreName).toBe("wir");
			expect(attestationWir.targetRef.suffixParts).toEqual([
				"personal",
				"pronomen",
				"de",
			]);
		}

		const relationArbeiten = wikilinks.find(
			(link) => link.target === "arbeiten",
		);
		expect(relationArbeiten?.intent).toBe("GenerateSectionLink");
		expect(relationArbeiten?.targetKind).toBe("Lemma");
		expect(relationArbeiten?.targetRef).toMatchObject({
			basename: "arbeiten",
			kind: "WorterNote",
			surfaceKind: "Lemma",
		});

		const inflectionAß = wikilinks.find((link) => link.target === "aß");
		expect(inflectionAß?.targetKind).toBe("Inflected");
		expect(inflectionAß?.targetRef).toMatchObject({
			basename: "aß",
			kind: "WorterNote",
			surfaceKind: "Inflected",
		});

		const freeformHaus = wikilinks.find(
			(link) => link.target === "Haus",
		);
		expect(freeformHaus?.source).toBe("UserAuthored");
		expect(freeformHaus?.intent).toBe("ManualSurfaceLookup");
		expect(freeformHaus?.targetKind).toBe("Surface");
	});

	it("captures anchors and explicit path links", () => {
		const entries: DictEntry[] = [
			{
				headerContent: "entry",
				id: "LX-LM-VERB-1",
				meta: {},
				sections: [
					section(
						DictSectionKind.Relation,
						"= [[Worter/de/lexem/lemma/a/arb/arbe/arbeiten#^lx-1|arbeiten]]",
					),
				],
			},
		];
		const noteText = dictNoteHelper.serialize(entries).body;
		const [entry] = dictNoteHelper.parseWithLinguisticWikilinks({
			noteText,
		});
		const [link] = entry?.linguisticWikilinks ?? [];
		expect(link?.anchor).toBe("#^lx-1");
		expect(link?.targetRef).toMatchObject({
			basename: "arbeiten",
			kind: "WorterNote",
		});
	});

	it("routes anchor-only wikilinks to unresolved target refs", () => {
		const entries: DictEntry[] = [
			{
				headerContent: "entry",
				id: "LX-LM-VERB-1",
				meta: {},
				sections: [
					section(
						DictSectionKind.Relation,
						"= [[#^local-anchor]]",
					),
				],
			},
		];
		const noteText = dictNoteHelper.serialize(entries).body;
		const [entry] = dictNoteHelper.parseWithLinguisticWikilinks({
			noteText,
		});
		const [link] = entry?.linguisticWikilinks ?? [];
		expect(link?.target).toBe("#^local-anchor");
		expect(link?.anchor).toBe("#^local-anchor");
		expect(link?.targetRef).toEqual({
			kind: "Unresolved",
			target: "#^local-anchor",
		});
	});
});
