import type {
	LanguagePack,
	SectionLinkPolicy,
	SectionSpec,
} from "../../core/contracts/language-pack";
import type { SectionKey } from "../../core/contracts/section-key";
import { cssSuffixFor } from "../../targets/de/sections/section-css-kind";
import { SECTION_DISPLAY_WEIGHT } from "../../targets/de/sections/section-config";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../targets/de/sections/section-kind";

const LINK_POLICY_BY_KIND: Record<DictSectionKind, SectionLinkPolicy> = {
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

const SECTION_KIND_BY_KEY: Record<SectionKey, DictSectionKind> = {
	attestation: DictSectionKind.Attestation,
	deviation: DictSectionKind.Deviation,
	freeform: DictSectionKind.FreeForm,
	header: DictSectionKind.Header,
	inflection: DictSectionKind.Inflection,
	morphem: DictSectionKind.Morphem,
	morphology: DictSectionKind.Morphology,
	relation: DictSectionKind.Relation,
	tags: DictSectionKind.Tags,
	translation: DictSectionKind.Translation,
};

function buildSectionSpec(key: SectionKey): SectionSpec {
	const kind = SECTION_KIND_BY_KEY[key];
	return {
		claimPolicy: {
			canClaim(input) {
				return (
					input.occurrence === 0 &&
					input.marker === cssSuffixFor[kind] &&
					input.title === TitleReprFor[kind].German
				);
			},
			fallback: "raw",
		},
		key,
		linkPolicy: LINK_POLICY_BY_KIND[kind],
		marker: cssSuffixFor[kind],
		order: SECTION_DISPLAY_WEIGHT[kind],
		titleFor(targetLang) {
			return TitleReprFor[kind][targetLang];
		},
	};
}

const sections = [
	buildSectionSpec("header"),
	buildSectionSpec("attestation"),
	buildSectionSpec("translation"),
	buildSectionSpec("relation"),
	buildSectionSpec("morphem"),
	buildSectionSpec("morphology"),
	buildSectionSpec("inflection"),
	buildSectionSpec("tags"),
	buildSectionSpec("freeform"),
	buildSectionSpec("deviation"),
] as const;

const sectionByKey = new Map(sections.map((section) => [section.key, section]));
const sectionByMarker = new Map(
	sections.map((section) => [section.marker, section]),
);

export const deLanguagePack: LanguagePack = {
	getSectionByMarker(marker) {
		return sectionByMarker.get(marker);
	},
	getSection(key) {
		const section = sectionByKey.get(key);
		if (!section) {
			throw new Error(`Unknown section key: ${key}`);
		}
		return section;
	},
	sections,
	targetLang: "German",
};

export function findSectionSpecByMarker(
	pack: LanguagePack,
	marker: string,
): SectionSpec | undefined {
	return pack.getSectionByMarker(marker);
}
