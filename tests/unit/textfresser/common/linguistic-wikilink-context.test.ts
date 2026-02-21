import { describe, expect, it } from "bun:test";
import {
	resolveDesiredSurfaceKindForPropagationSection,
	resolveSectionLinkPolicyForCssKind,
	resolveSectionLinkPolicyForKind,
	shouldPropagateLinksForSection,
} from "../../../../src/commanders/textfresser/common/linguistic-wikilink-context";
import { cssSuffixFor } from "../../../../src/commanders/textfresser/targets/de/sections/section-css-kind";
import {
	ALL_DICT_SECTION_KINDS,
	DictSectionKind,
} from "../../../../src/commanders/textfresser/targets/de/sections/section-kind";

describe("linguistic-wikilink-context", () => {
	it("classifies FreeForm as user-authored manual surface lookup", () => {
		const policy = resolveSectionLinkPolicyForKind(DictSectionKind.FreeForm);
		expect(policy.source).toBe("UserAuthored");
		expect(policy.sectionIntent).toBe("ManualSurfaceLookup");
		expect(policy.targetKind).toBe("Surface");
		expect(policy.propagates).toBe(false);
	});

	it("classifies Attestation as semantic attestation links", () => {
		const policy = resolveSectionLinkPolicyForKind(
			DictSectionKind.Attestation,
		);
		expect(policy.source).toBe("TextfresserCommand");
		expect(policy.sectionIntent).toBe("LemmaSemanticAttestation");
		expect(policy.targetKind).toBe("Surface");
		expect(policy.propagates).toBe(false);
	});

	it("classifies propagation sections with lemma/inflected targets", () => {
		expect(
			resolveDesiredSurfaceKindForPropagationSection(
				DictSectionKind.Relation,
			),
		).toBe("Lemma");
		expect(
			resolveDesiredSurfaceKindForPropagationSection(
				DictSectionKind.Morphology,
			),
		).toBe("Lemma");
		expect(
			resolveDesiredSurfaceKindForPropagationSection(
				DictSectionKind.Morphem,
			),
		).toBe("Lemma");
		expect(
			resolveDesiredSurfaceKindForPropagationSection(
				DictSectionKind.Inflection,
			),
		).toBe("Inflected");
	});

	it("uses css-kind mapping consistently with section-kind mapping", () => {
		const byKind = resolveSectionLinkPolicyForKind(DictSectionKind.Relation);
		const byCss = resolveSectionLinkPolicyForCssKind(
			cssSuffixFor[DictSectionKind.Relation],
		);
		expect(byCss).toEqual(byKind);
		expect(shouldPropagateLinksForSection(DictSectionKind.Relation)).toBe(
			true,
		);
		expect(shouldPropagateLinksForSection(DictSectionKind.Translation)).toBe(
			false,
		);
	});

	it("covers policy mapping for all section kinds", () => {
		for (const sectionKind of ALL_DICT_SECTION_KINDS) {
			const policyByKind = resolveSectionLinkPolicyForKind(sectionKind);
			const policyByCss = resolveSectionLinkPolicyForCssKind(
				cssSuffixFor[sectionKind],
			);
			expect(policyByCss).toEqual(policyByKind);
			expect(shouldPropagateLinksForSection(sectionKind)).toBe(
				policyByKind.propagates,
			);

			const desiredSurfaceKind =
				resolveDesiredSurfaceKindForPropagationSection(sectionKind);
			if (policyByKind.targetKind === "Lemma") {
				expect(desiredSurfaceKind).toBe("Lemma");
			} else if (policyByKind.targetKind === "Inflected") {
				expect(desiredSurfaceKind).toBe("Inflected");
			} else {
				expect(desiredSurfaceKind).toBeNull();
			}
		}
	});
});
