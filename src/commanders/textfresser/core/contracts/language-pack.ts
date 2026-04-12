import type { TargetLanguage } from "../../../../types";
import type { SectionKey } from "./section-key";

export type LinguisticWikilinkSource = "UserAuthored" | "TextfresserCommand";

export type LinguisticWikilinkIntent =
	| "ManualSurfaceLookup"
	| "LemmaSemanticAttestation"
	| "GenerateSectionLink"
	| "PropagationLink";

export type LinguisticWikilinkTargetKind =
	| "Lemma"
	| "Inflection"
	| "Surface"
	| "None";

export type SectionLinkPolicy = {
	source: LinguisticWikilinkSource;
	sectionIntent: Exclude<LinguisticWikilinkIntent, "PropagationLink">;
	targetKind: LinguisticWikilinkTargetKind;
	propagates: boolean;
};

export type SectionClaimInput = {
	marker: string;
	title: string;
	content: string;
	occurrence: number;
};

export type SectionClaimFallbackPolicy = {
	fallback: "raw";
	canClaim(input: SectionClaimInput): boolean;
};

export type SectionSpec = {
	key: SectionKey;
	marker: string;
	order: number;
	titleFor(targetLang: TargetLanguage): string;
	linkPolicy: SectionLinkPolicy;
	claimPolicy: SectionClaimFallbackPolicy;
};

export type LanguagePack = {
	targetLang: TargetLanguage;
	sections: readonly SectionSpec[];
	getSection(key: SectionKey): SectionSpec;
	getSectionByMarker(marker: string): SectionSpec | undefined;
};

export function findSectionSpecByMarker(
	pack: LanguagePack,
	marker: string,
): SectionSpec | undefined {
	return pack.getSectionByMarker(marker);
}
