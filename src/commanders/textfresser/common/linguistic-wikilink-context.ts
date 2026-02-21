import { SurfaceKind } from "../../../linguistics/common/enums/core";
import { cssSuffixFor } from "../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	type DictSectionKind as DictSectionKindType,
} from "../targets/de/sections/section-kind";

export type LinguisticWikilinkSource =
	| "UserAuthored"
	| "TextfresserCommand";

export type LinguisticWikilinkIntent =
	| "ManualSurfaceLookup"
	| "LemmaSemanticAttestation"
	| "GenerateSectionLink"
	| "PropagationLink";

export type LinguisticWikilinkTargetKind =
	| "Lemma"
	| "Inflected"
	| "Surface"
	| "None";

export type SectionLinkPolicy = {
	source: LinguisticWikilinkSource;
	sectionIntent: Exclude<LinguisticWikilinkIntent, "PropagationLink">;
	targetKind: LinguisticWikilinkTargetKind;
	propagates: boolean;
};

const SECTION_LINK_POLICY_BY_KIND: Record<
	DictSectionKindType,
	SectionLinkPolicy
> = {
	[DictSectionKind.Attestation]: {
		propagates: false,
		sectionIntent: "LemmaSemanticAttestation",
		source: "TextfresserCommand",
		targetKind: "Surface",
	},
	[DictSectionKind.Deviation]: {
		propagates: false,
		sectionIntent: "GenerateSectionLink",
		source: "TextfresserCommand",
		targetKind: "None",
	},
	[DictSectionKind.FreeForm]: {
		propagates: false,
		sectionIntent: "ManualSurfaceLookup",
		source: "UserAuthored",
		targetKind: "Surface",
	},
	[DictSectionKind.Header]: {
		propagates: false,
		sectionIntent: "GenerateSectionLink",
		source: "TextfresserCommand",
		targetKind: "None",
	},
	[DictSectionKind.Inflection]: {
		propagates: true,
		sectionIntent: "GenerateSectionLink",
		source: "TextfresserCommand",
		targetKind: "Inflected",
	},
	[DictSectionKind.Morphem]: {
		propagates: true,
		sectionIntent: "GenerateSectionLink",
		source: "TextfresserCommand",
		targetKind: "Lemma",
	},
	[DictSectionKind.Morphology]: {
		propagates: true,
		sectionIntent: "GenerateSectionLink",
		source: "TextfresserCommand",
		targetKind: "Lemma",
	},
	[DictSectionKind.Relation]: {
		propagates: true,
		sectionIntent: "GenerateSectionLink",
		source: "TextfresserCommand",
		targetKind: "Lemma",
	},
	[DictSectionKind.Tags]: {
		propagates: false,
		sectionIntent: "GenerateSectionLink",
		source: "TextfresserCommand",
		targetKind: "None",
	},
	[DictSectionKind.Translation]: {
		propagates: false,
		sectionIntent: "GenerateSectionLink",
		source: "TextfresserCommand",
		targetKind: "None",
	},
};

const SECTION_LINK_POLICY_BY_CSS_KIND = new Map<string, SectionLinkPolicy>(
	Object.values(DictSectionKind).map((kind) => [
		cssSuffixFor[kind],
		SECTION_LINK_POLICY_BY_KIND[kind],
	]),
);

const DEFAULT_SECTION_POLICY: SectionLinkPolicy = {
	propagates: false,
	sectionIntent: "GenerateSectionLink",
	source: "TextfresserCommand",
	targetKind: "None",
};

export function resolveSectionLinkPolicyForKind(
	sectionKind: DictSectionKindType,
): SectionLinkPolicy {
	return SECTION_LINK_POLICY_BY_KIND[sectionKind];
}

export function resolveSectionLinkPolicyForCssKind(
	sectionCssKind: string,
): SectionLinkPolicy {
	return (
		SECTION_LINK_POLICY_BY_CSS_KIND.get(sectionCssKind) ??
		DEFAULT_SECTION_POLICY
	);
}

export function shouldPropagateLinksForSection(
	sectionKind: DictSectionKindType,
): boolean {
	return resolveSectionLinkPolicyForKind(sectionKind).propagates;
}

export function resolveDesiredSurfaceKindForPropagationSection(
	sectionKind: DictSectionKindType,
): SurfaceKind | null {
	const { targetKind } = resolveSectionLinkPolicyForKind(sectionKind);
	if (targetKind === "Lemma") {
		return SurfaceKind.Lemma;
	}
	if (targetKind === "Inflected") {
		return SurfaceKind.Inflected;
	}
	return null;
}
