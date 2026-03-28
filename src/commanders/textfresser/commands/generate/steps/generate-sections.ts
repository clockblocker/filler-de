import { ResultAsync } from "neverthrow";
import type {
	LexicalGenerationError,
	LexicalInfo,
} from "@textfresser/lexical-generation";
import { getErrorMessage } from "../../../../../utils/get-error-message";
import type { NoteEntry } from "../../../core/notes/types";
import { cssSuffixFor } from "../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../targets/de/sections/section-kind";
import type { CommandError } from "../../types";
import { commandApiError } from "../../types";
import { buildLexicalMeta } from "./build-lexical-meta";
import { ensureClosedSetMembershipEntry } from "./closed-set-membership-entry";
import {
	buildFeatureTagPath,
	getFeaturesPromptKindForPos,
} from "./features-prompt-dispatch";
import { generateNewEntrySections } from "./generate-new-entry-sections";
import type { GenerateSectionsResult } from "./generate-sections-result";
import {
	computeMissingV3SectionKinds,
	computeMissingV3SectionKindsFromLemmaResult,
} from "./reencounter-sections";
import type { ResolvedEntryState } from "./resolve-existing-entry";
import {
	buildVerbEntryIdentityFromFeatures,
	getVerbLexicalFeatures,
} from "./verb-features";
import {
	adaptLegacySectionsForEntry,
	findFirstTypedSectionByMarker,
	getTypedSectionContent,
	hasTypedSectionWithMarker,
	insertSectionByOrder,
	setTypedSectionContent,
} from "./canonical-note-entry";

export { buildLexicalMeta } from "./build-lexical-meta";
export { buildFeatureTagPath, getFeaturesPromptKindForPos };
export type { GenerateSectionsResult } from "./generate-sections-result";
export type { ParsedRelation } from "./section-generation-types";

function isLexicalGenerationError(
	error: unknown,
): error is LexicalGenerationError {
	return (
		typeof error === "object" &&
		error !== null &&
		"kind" in error &&
		"message" in error &&
		typeof error.kind === "string" &&
		typeof error.message === "string"
	);
}

function toGenerateCommandError(error: unknown): CommandError {
	if (isLexicalGenerationError(error)) {
		return commandApiError({
			lexicalGenerationError: error,
			reason: error.message,
		});
	}

	return commandApiError({
		reason: getErrorMessage(error),
	});
}

function appendAttestation(entry: NoteEntry, ctx: ResolvedEntryState): void {
	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const attestationRef = lemmaResult.attestation.source.ref;
	const attestationCssSuffix = cssSuffixFor[DictSectionKind.Attestation];
	const attestationSection = findFirstTypedSectionByMarker(
		entry,
		attestationCssSuffix,
	);

	if (attestationSection) {
		const existingContent = getTypedSectionContent(attestationSection);
		if (!existingContent.includes(attestationRef)) {
			setTypedSectionContent(
				attestationSection,
				existingContent.length > 0
					? `${existingContent}\n\n${attestationRef}`
					: attestationRef,
			);
		}
	} else {
		const targetLang = ctx.textfresserState.languages.target;
		const [section] = adaptLegacySectionsForEntry(entry, [
			{
				content: attestationRef,
				kind: attestationCssSuffix,
				title: TitleReprFor[DictSectionKind.Attestation][targetLang],
			},
		]);
		if (section) {
			insertSectionByOrder(entry, section);
		}
	}
}

function ensureClosedSetMembershipEntries(params: {
	ctx: ResolvedEntryState;
	existingEntries: NoteEntry[];
}): NoteEntry[] {
	const lemmaResult = params.ctx.textfresserState.latestLemmaResult;
	if (lemmaResult.linguisticUnit !== "Lexem") {
		return params.existingEntries;
	}

	const membershipResult = ensureClosedSetMembershipEntry({
		existingEntries: params.existingEntries,
		lemmaResult,
		lookupInLibrary: params.ctx.textfresserState.lookupInLibrary,
		targetLanguage: params.ctx.textfresserState.languages.target,
	});

	return membershipResult?.entries ?? params.existingEntries;
}

async function generateLexicalInfoForEntry(
	ctx: ResolvedEntryState,
): Promise<LexicalInfo> {
	const lexicalGeneration = ctx.textfresserState.lexicalGeneration;
	if (!lexicalGeneration) {
		throw (
			ctx.textfresserState.lexicalGenerationInitError ??
			new Error("Lexical generation is unavailable")
		);
	}

	const lexicalInfoResult = await lexicalGeneration.generateLexicalInfo(
		ctx.textfresserState.latestLemmaResult,
		ctx.textfresserState.latestLemmaResult.attestation.source
			.textWithOnlyTargetMarked,
		{
			precomputedEmojiDescription:
				ctx.textfresserState.latestLemmaResult
					.precomputedEmojiDescription,
		},
	);
	if (lexicalInfoResult.isErr()) {
		throw lexicalInfoResult.error;
	}

	return lexicalInfoResult.value;
}

async function buildReEncounterResult(
	ctx: ResolvedEntryState,
): Promise<GenerateSectionsResult> {
	const { matchedEntry, existingEntries } = ctx;
	const lemmaResult = ctx.textfresserState.latestLemmaResult;
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
	const entriesWithMembership = ensureClosedSetMembershipEntries({
		ctx,
		existingEntries,
	});
	const canUseLemmaOnlyFastPath = !(
		lemmaResult.linguisticUnit === "Lexem" &&
		lemmaResult.posLikeKind === "Noun"
	);
	if (canUseLemmaOnlyFastPath) {
		const missingSections = computeMissingV3SectionKindsFromLemmaResult({
			entry: matchedEntry,
			lemmaResult,
		});
		if (missingSections.length === 0) {
			ctx.textfresserState.latestFailedSections = [];
			ctx.textfresserState.targetBlockId = matchedEntry.id;

			return {
				...ctx,
				allEntries: entriesWithMembership,
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
	}
	const lexicalInfo = await generateLexicalInfoForEntry(ctx);
	const missingSectionKinds = computeMissingV3SectionKinds({
		entry: matchedEntry,
		lexicalInfo,
	});

	if (missingSectionKinds.length === 0) {
		ctx.textfresserState.latestFailedSections = [];
		ctx.textfresserState.targetBlockId = matchedEntry.id;

		return {
			...ctx,
			allEntries: entriesWithMembership,
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
		lexicalInfoOverride: lexicalInfo,
		onlySections: new Set(missingSectionKinds),
	});
	const missingCssKinds = new Set(
		missingSectionKinds.map((sectionKind) => cssSuffixFor[sectionKind]),
	);
	const adaptedSections = adaptLegacySectionsForEntry(
		matchedEntry,
		generated.sections,
	);
	for (let index = 0; index < generated.sections.length; index += 1) {
		const legacySection = generated.sections[index];
		const adaptedSection = adaptedSections[index];
		if (!legacySection || !adaptedSection) {
			continue;
		}
		if (
			!hasTypedSectionWithMarker(matchedEntry, legacySection.kind) &&
			missingCssKinds.has(legacySection.kind)
		) {
			insertSectionByOrder(matchedEntry, adaptedSection);
		}
	}

	ctx.textfresserState.latestFailedSections = generated.failedSections;
	ctx.textfresserState.targetBlockId = matchedEntry.id;
	return {
		...ctx,
		allEntries: entriesWithMembership,
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

function getVerbEntryIdentity(entry: NoteEntry): string | null {
	const fromMeta = entry.meta.verbEntryIdentity;
	if (typeof fromMeta === "string" && fromMeta.length > 0) {
		return fromMeta;
	}

	return null;
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
			toGenerateCommandError,
		);
	}

	return ResultAsync.fromPromise(
		(async () => {
			const generated = await generateNewEntrySections(ctx);
			const lemmaResult = ctx.textfresserState.latestLemmaResult;
			const isVerbLexem =
				lemmaResult.linguisticUnit === "Lexem" &&
				lemmaResult.posLikeKind === "Verb";
			const verbFeatures = getVerbLexicalFeatures(generated.lexicalInfo);
			const verbEntryIdentity =
				isVerbLexem && verbFeatures
					? buildVerbEntryIdentityFromFeatures(verbFeatures)
					: undefined;

			if (verbEntryIdentity) {
				const matchedByVerbIdentity = ctx.existingEntries.find(
					(entry) =>
						getVerbEntryIdentity(entry) === verbEntryIdentity,
				);

				if (matchedByVerbIdentity) {
					appendAttestation(matchedByVerbIdentity, ctx);
					const entriesWithMembership =
						ensureClosedSetMembershipEntries({
							ctx,
							existingEntries: ctx.existingEntries,
						});
					matchedByVerbIdentity.meta.verbEntryIdentity =
						verbEntryIdentity;
					ctx.textfresserState.latestFailedSections =
						generated.failedSections;
					ctx.textfresserState.targetBlockId =
						matchedByVerbIdentity.id;

					return {
						...ctx,
						allEntries: entriesWithMembership,
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

			const newEntry: NoteEntry = {
				headerContent: generated.headerContent,
				id: generated.entryId,
				meta: {
					lexicalMeta: buildLexicalMeta(
						lemmaResult,
						generated.lexicalInfo,
					),
					...(verbEntryIdentity ? { verbEntryIdentity } : {}),
				},
				sections: [],
			};
			newEntry.sections.push(
				...adaptLegacySectionsForEntry(newEntry, generated.sections),
			);

			ctx.textfresserState.latestFailedSections =
				generated.failedSections;
			ctx.textfresserState.targetBlockId = generated.entryId;
			const entriesWithNewEntry = [...ctx.existingEntries, newEntry];
			const allEntries = ensureClosedSetMembershipEntries({
				ctx,
				existingEntries: entriesWithNewEntry,
			});

			return {
				...ctx,
				allEntries,
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
		toGenerateCommandError,
	);
}
