import type {
	LinguisticUnitKind,
	POS,
	SurfaceKind,
} from "../../domain/note-linguistic-policy";
import type { SectionKey } from "../contracts/section-key";
import { entryIdentity } from "./entry-identity";

export type MatchableEntry = {
	id: string;
	sections: Array<{ kind: string; marker?: string }>;
	linguisticWikilinks: Array<{ intent: string }>;
};

export type EntryStubPolicy = {
	getSectionKey(section: MatchableEntry["sections"][number]): SectionKey | undefined;
	propagationOnlyKeys: readonly SectionKey[];
};

export type ResolveEntryMatchParams<TEntry extends MatchableEntry> = {
	disambiguationResult: { matchedIndex: number } | null;
	existingEntries: readonly TEntry[];
	linguisticUnit: LinguisticUnitKind;
	posLikeKind?: POS;
	stubPolicy: EntryStubPolicy;
	surfaceKind: SurfaceKind;
};

export type ResolveEntryMatchResult<TEntry extends MatchableEntry> = {
	existingEntries: TEntry[];
	matchedEntry: TEntry | null;
	nextIndex: number;
};

function isPropagationOnlyStubEntry(
	entry: MatchableEntry,
	stubPolicy: EntryStubPolicy,
): boolean {
	const sectionKeys = new Set(
		entry.sections
			.map((section) => stubPolicy.getSectionKey(section))
			.filter((key): key is SectionKey => key !== undefined),
	);
	const hasAttestation = sectionKeys.has("attestation");
	const hasTranslation = sectionKeys.has("translation");
	const hasPropagationOnlySection = [...sectionKeys].some((key) =>
		stubPolicy.propagationOnlyKeys.includes(key),
	);

	return !hasAttestation && !hasTranslation && hasPropagationOnlySection;
}

function isPropagationOnlyStubEntryWithWikilinks(
	entry: MatchableEntry,
	stubPolicy: EntryStubPolicy,
): boolean {
	const hasNonGeneratedIntentLink = entry.linguisticWikilinks.some(
		(wikilink) => wikilink.intent !== "GenerateSectionLink",
	);
	if (hasNonGeneratedIntentLink) {
		return false;
	}
	return isPropagationOnlyStubEntry(entry, stubPolicy);
}

export function resolveEntryMatch<TEntry extends MatchableEntry>(
	params: ResolveEntryMatchParams<TEntry>,
): ResolveEntryMatchResult<TEntry> {
	const prefix = entryIdentity.buildPrefix(
		params.linguisticUnit,
		params.surfaceKind,
		params.linguisticUnit === "Lexeme" ? params.posLikeKind : undefined,
	);

	let existingEntries = [...params.existingEntries];
	let matchedEntry: TEntry | null = null;
	if (params.disambiguationResult) {
		matchedEntry =
			existingEntries.find((entry) => {
				const parsed = entryIdentity.parse(entry.id);
				return (
					parsed !== undefined &&
					parsed.index === params.disambiguationResult?.matchedIndex &&
					parsed.unitKind === params.linguisticUnit &&
					(params.linguisticUnit !== "Lexeme" ||
						parsed.pos === params.posLikeKind)
				);
			}) ?? null;
	}

	if (
		matchedEntry &&
		isPropagationOnlyStubEntryWithWikilinks(matchedEntry, params.stubPolicy)
	) {
		existingEntries = existingEntries.filter(
			(entry) => entry.id !== matchedEntry?.id,
		);
		matchedEntry = null;
	}

	const nextIndex = entryIdentity.nextIndex(
		existingEntries.map((entry) => entry.id),
		prefix,
	);

	return {
		existingEntries,
		matchedEntry,
		nextIndex,
	};
}
