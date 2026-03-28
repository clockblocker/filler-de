import { describe, expect, it } from "bun:test";
import {
	deLanguagePack,
	findSectionSpecByMarker,
} from "../../../../../src/commanders/textfresser/languages/de/pack";

describe("deLanguagePack", () => {
	it("maps current German section metadata onto stable section keys", () => {
		const relation = deLanguagePack.getSection("relation");
		const freeform = deLanguagePack.getSection("freeform");

		expect(relation.marker).toBe("synonyme");
		expect(relation.titleFor("German")).toBe("Semantische Beziehungen");
		expect(relation.order).toBe(2);
		expect(relation.linkPolicy).toEqual({
			propagates: true,
			sectionIntent: "GenerateSectionLink",
			source: "TextfresserCommand",
			targetKind: "Lemma",
		});

		expect(freeform.marker).toBe("notizen");
		expect(freeform.titleFor("German")).toBe("Notizen");
		expect(freeform.linkPolicy).toEqual({
			propagates: false,
			sectionIntent: "ManualSurfaceLookup",
			source: "UserAuthored",
			targetKind: "Surface",
		});
	});

	it("claims sections only when marker and title match the current German catalog", () => {
		const relation = deLanguagePack.getSection("relation");

		expect(
			relation.claimPolicy.canClaim({
				content: "= [[Haus]]",
				marker: "synonyme",
				occurrence: 0,
				title: "Semantische Beziehungen",
			}),
		).toBe(true);
		expect(
			relation.claimPolicy.canClaim({
				content: "= [[Haus]]",
				marker: "synonyme",
				occurrence: 0,
				title: "Custom Title",
			}),
		).toBe(false);
		expect(
			relation.claimPolicy.canClaim({
				content: "= [[Haus]]",
				marker: "synonyme",
				occurrence: 1,
				title: "Semantische Beziehungen",
			}),
		).toBe(false);
	});

	it("resolves section specs by marker", () => {
		expect(findSectionSpecByMarker(deLanguagePack, "translations")?.key).toBe(
			"translation",
		);
		expect(findSectionSpecByMarker(deLanguagePack, "missing")).toBeUndefined();
	});
});
