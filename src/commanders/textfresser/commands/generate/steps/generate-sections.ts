import { ResultAsync } from "neverthrow";
import type { DictEntry } from "../../../domain/dict-note/types";
import { toApiCommandError } from "../../../errors";
import { cssSuffixFor } from "../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../targets/de/sections/section-kind";
import type { CommandError } from "../../types";
import {
	buildEntityMeta,
	buildLinguisticUnitMeta,
} from "./build-linguistic-unit-meta";
import {
	buildFeatureTagPath,
	getFeaturesPromptKindForPos,
} from "./features-prompt-dispatch";
import { generateNewEntrySections } from "./generate-new-entry-sections";
import type { GenerateSectionsResult } from "./generate-sections-result";
import { computeMissingV3SectionKinds } from "./reencounter-sections";
import type { ResolvedEntryState } from "./resolve-existing-entry";
import {
	buildVerbEntryIdentityFromFeatures,
	isVerbFeaturesOutput,
} from "./verb-features";

export {
	buildEntityMeta,
	buildLinguisticUnitMeta,
} from "./build-linguistic-unit-meta";
export { buildFeatureTagPath, getFeaturesPromptKindForPos };
export type { GenerateSectionsResult } from "./generate-sections-result";
export type { ParsedRelation } from "./section-generation-types";

function appendAttestation(entry: DictEntry, ctx: ResolvedEntryState): void {
	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const attestationRef = lemmaResult.attestation.source.ref;
	const attestationCssSuffix = cssSuffixFor[DictSectionKind.Attestation];
	const attestationSection = entry.sections.find(
		(section) => section.kind === attestationCssSuffix,
	);

	if (attestationSection) {
		if (!attestationSection.content.includes(attestationRef)) {
			attestationSection.content += `\n\n${attestationRef}`;
		}
	} else {
		const targetLang = ctx.textfresserState.languages.target;
		entry.sections.push({
			content: attestationRef,
			kind: attestationCssSuffix,
			title: TitleReprFor[DictSectionKind.Attestation][targetLang],
		});
	}
}

async function buildReEncounterResult(
	ctx: ResolvedEntryState,
): Promise<GenerateSectionsResult> {
	const { matchedEntry, existingEntries } = ctx;
	if (!matchedEntry) {
		ctx.textfresserState.latestFailedSections = [];
		return {
			...ctx,
			allEntries: existingEntries,
			failedSections: [],
			inflectionCells: [],
			morphemes: [],
			morphology: undefined,
			nounInflectionGenus: undefined,
			relations: [],
			sourceTranslation: undefined,
			targetBlockId: undefined,
		};
	}

	appendAttestation(matchedEntry, ctx);
	const missingSectionKinds = computeMissingV3SectionKinds({
		entry: matchedEntry,
		lemmaResult: ctx.textfresserState.latestLemmaResult,
	});

	if (missingSectionKinds.length === 0) {
		ctx.textfresserState.latestFailedSections = [];
		ctx.textfresserState.targetBlockId = matchedEntry.id;

		return {
			...ctx,
			allEntries: existingEntries,
			failedSections: [],
			inflectionCells: [],
			morphemes: [],
			morphology: undefined,
			nounInflectionGenus: undefined,
			relations: [],
			sourceTranslation: undefined,
			targetBlockId: matchedEntry.id,
		};
	}

	const generated = await generateNewEntrySections(ctx, {
		onlySections: new Set(missingSectionKinds),
	});
	const missingCssKinds = new Set(
		missingSectionKinds.map((sectionKind) => cssSuffixFor[sectionKind]),
	);
	for (const section of generated.sections) {
		const alreadyExists = matchedEntry.sections.some(
			(existing) => existing.kind === section.kind,
		);
		if (!alreadyExists && missingCssKinds.has(section.kind)) {
			matchedEntry.sections.push(section);
		}
	}

	ctx.textfresserState.latestFailedSections = generated.failedSections;
	ctx.textfresserState.targetBlockId = matchedEntry.id;
	return {
		...ctx,
		allEntries: existingEntries,
		failedSections: generated.failedSections,
		inflectionCells: generated.inflectionCells,
		morphemes: generated.morphemes,
		morphology: generated.morphology,
		nounInflectionGenus: generated.nounInflectionGenus,
		relations: generated.relations,
		sourceTranslation: generated.sourceTranslation,
		targetBlockId: matchedEntry.id,
	};
}

function getVerbEntryIdentity(entry: DictEntry): string | null {
	const fromMeta = entry.meta.verbEntryIdentity;
	if (typeof fromMeta === "string" && fromMeta.length > 0) {
		return fromMeta;
	}

	const linguisticUnit = entry.meta.linguisticUnit;
	if (!linguisticUnit || linguisticUnit.kind !== "Lexem") {
		return null;
	}

	const surface = linguisticUnit.surface;
	if (surface.surfaceKind !== "Lemma" || surface.features.pos !== "Verb") {
		return null;
	}

	return buildVerbEntryIdentityFromFeatures({
		conjugation: surface.features.conjugation,
		valency: surface.features.valency,
	});
}

/**
 * Generate dictionary entry sections via LLM calls, or append attestation to existing entry.
 *
 * Path A (re-encounter): matchedEntry exists → append attestation ref, regenerate only missing V3 sections
 * Path B (new entry): full LLM pipeline → build new DictEntry with computed nextIndex
 */
export function generateSections(
	ctx: ResolvedEntryState,
): ResultAsync<GenerateSectionsResult, CommandError> {
	if (ctx.matchedEntry) {
		return ResultAsync.fromPromise(
			buildReEncounterResult(ctx),
			toApiCommandError,
		);
	}

	return ResultAsync.fromPromise(
		(async () => {
			const generated = await generateNewEntrySections(ctx);
			const lemmaResult = ctx.textfresserState.latestLemmaResult;
			const isVerbLexem =
				lemmaResult.linguisticUnit === "Lexem" &&
				lemmaResult.posLikeKind === "Verb";
			const verbEntryIdentity =
				isVerbLexem && isVerbFeaturesOutput(generated.featuresOutput)
					? buildVerbEntryIdentityFromFeatures(
							generated.featuresOutput,
						)
					: undefined;

			if (verbEntryIdentity) {
				const matchedByVerbIdentity = ctx.existingEntries.find(
					(entry) =>
						getVerbEntryIdentity(entry) === verbEntryIdentity,
				);

				if (matchedByVerbIdentity) {
					appendAttestation(matchedByVerbIdentity, ctx);
					matchedByVerbIdentity.meta.verbEntryIdentity =
						verbEntryIdentity;
					ctx.textfresserState.latestFailedSections =
						generated.failedSections;
					ctx.textfresserState.targetBlockId =
						matchedByVerbIdentity.id;

					return {
						...ctx,
						allEntries: ctx.existingEntries,
						failedSections: generated.failedSections,
						inflectionCells: [],
						morphemes: [],
						morphology: undefined,
						nounInflectionGenus: undefined,
						relations: [],
						sourceTranslation: undefined,
						targetBlockId: matchedByVerbIdentity.id,
					};
				}
			}

			const linguisticUnit = buildLinguisticUnitMeta(
				generated.entryId,
				lemmaResult,
				generated.enrichmentOutput,
				generated.featuresOutput,
			);
			const entity = buildEntityMeta(
				lemmaResult,
				generated.enrichmentOutput,
				generated.featuresOutput,
			);
			const emojiDescription =
				entity?.emojiDescription ??
				lemmaResult.precomputedEmojiDescription ??
				generated.enrichmentOutput.emojiDescription;
			const senseGloss =
				entity?.senseGloss ?? generated.enrichmentOutput.senseGloss;

			const newEntry: DictEntry = {
				headerContent: generated.headerContent,
				id: generated.entryId,
				meta: {
					...(entity ? { entity } : {}),
					emojiDescription,
					...(senseGloss ? { senseGloss } : {}),
					...(verbEntryIdentity ? { verbEntryIdentity } : {}),
					...(linguisticUnit ? { linguisticUnit } : {}),
				},
				sections: generated.sections,
			};

			ctx.textfresserState.latestFailedSections =
				generated.failedSections;
			ctx.textfresserState.targetBlockId = generated.entryId;

			return {
				...ctx,
				allEntries: [...ctx.existingEntries, newEntry],
				failedSections: generated.failedSections,
				inflectionCells: generated.inflectionCells,
				morphemes: generated.morphemes,
				morphology: generated.morphology,
				nounInflectionGenus: generated.nounInflectionGenus,
				relations: generated.relations,
				sourceTranslation: generated.sourceTranslation,
				targetBlockId: generated.entryId,
			};
		})(),
		toApiCommandError,
	);
}
