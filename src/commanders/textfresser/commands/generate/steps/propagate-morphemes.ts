/**
 * Propagate morpheme back-references to target notes.
 *
 * For each morpheme in a multi-morpheme word, creates a structured DictEntry
 * on the morpheme's target note (e.g., prefix note in Library, or root/suffix
 * note in Wörter). Entries include header, tags, and attestation sections.
 *
 * Prefix entries are discriminated by separability: "aufpassen" (separable)
 * and "aufgrund" (inseparable) produce separate entries with different headers
 * (`>auf` vs `auf<`) and different tag sections.
 *
 * Skips single-morpheme words (simple roots like "Hand") since there's nothing
 * to cross-reference.
 */

import { ok, type Result } from "neverthrow";
import { SurfaceKind } from "../../../../../linguistics/common/enums/core";
import type { VaultAction } from "../../../../../managers/obsidian/vault-action-manager";
import {
	SplitPathKind,
	type SplitPathToMdFile,
} from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import { wikilinkHelper } from "../../../../../stateless-helpers/wikilink";
import type { TargetLanguage } from "../../../../../types";
import {
	buildPropagationActionPair,
	resolveTargetPath,
} from "../../../common/target-path-resolver";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import { dictNoteHelper } from "../../../domain/dict-note";
import type { DictEntry, EntrySection } from "../../../domain/dict-note/types";
import {
	type MorphemeItem,
	morphemeFormatterHelper,
} from "../../../domain/morpheme/morpheme-formatter";
import { cssSuffixFor } from "../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../targets/de/sections/section-kind";
import type { CommandError } from "../../types";
import type { GenerateSectionsResult } from "./generate-sections";

/**
 * Build a Library split path for a known German prefix.
 * Convention: `Library/de/prefix/{surf}.md`
 */
function buildPrefixLibraryPath(surf: string): SplitPathToMdFile {
	return {
		basename: surf.toLowerCase(),
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: ["Library", "de", "prefix"],
	};
}

/**
 * Resolve the target split path for a morpheme.
 *
 * - Prefix with linkTarget (known German prefix): try VAM/librarian lookup, fall back to Library path
 * - Others: use standard resolveTargetPath (goes to Wörter)
 */
function resolveMorphemePath(
	item: MorphemeItem,
	ctx: GenerateSectionsResult,
): { splitPath: SplitPathToMdFile; healingActions: VaultAction[] } {
	const targetLang = ctx.textfresserState.languages.target;

	if (item.linkTarget) {
		// Known prefix — look up by linkTarget basename, fall back to Library path
		const vamResults = ctx.textfresserState.vam.findByBasename(
			item.linkTarget,
		);
		if (vamResults.length > 0) {
			const existing = vamResults[0];
			if (existing) {
				return { healingActions: [], splitPath: existing };
			}
		}

		const libResults = ctx.textfresserState.lookupInLibrary(
			item.linkTarget,
		);
		if (libResults.length > 0) {
			const existing = libResults[0];
			if (existing) {
				return { healingActions: [], splitPath: existing };
			}
		}

		return {
			healingActions: [],
			splitPath: buildPrefixLibraryPath(item.surf),
		};
	}

	// Non-prefix morpheme — resolve to Wörter via standard path
	const word = item.lemma ?? item.surf;
	return resolveTargetPath({
		desiredSurfaceKind: SurfaceKind.Lemma,
		librarianLookup: ctx.textfresserState.lookupInLibrary,
		targetLanguage: targetLang,
		unitKind: "Morphem",
		vamLookup: (w) => ctx.textfresserState.vam.findByBasename(w),
		word,
	});
}

/** Build the header string for a morpheme entry. */
function buildMorphemeHeader(
	item: MorphemeItem,
	targetLang: TargetLanguage,
): string {
	if (item.kind === "Prefix") {
		return morphemeFormatterHelper.decorateSurface(
			item.surf,
			item.separability,
			targetLang,
		);
	}
	return item.lemma ?? item.surf;
}

/** Build the tag content for a morpheme entry (e.g. `#prefix/separable`). */
function buildMorphemeTagContent(item: MorphemeItem): string {
	const kindTag = item.kind.toLowerCase();
	if (item.kind === "Prefix" && item.separability) {
		return `#${kindTag}/${item.separability.toLowerCase()}`;
	}
	return `#${kindTag}`;
}

/**
 * For each morpheme in a multi-morpheme word, generate actions that create
 * or update structured DictEntry on the morpheme's target note.
 */
export function propagateMorphemes(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	const { morphemes } = ctx;
	// Skip single-morpheme words — nothing to cross-reference
	if (morphemes.length <= 1) {
		return ok(ctx);
	}

	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const sourceWord = lemmaResult.lemma;
	const targetLang = ctx.textfresserState.languages.target;

	const attestationCssSuffix = cssSuffixFor[DictSectionKind.Attestation];
	const attestationTitle =
		TitleReprFor[DictSectionKind.Attestation][targetLang];
	const tagsCssSuffix = cssSuffixFor[DictSectionKind.Tags];
	const tagsTitle = TitleReprFor[DictSectionKind.Tags][targetLang];

	const propagationActions: VaultAction[] = [];

	for (const item of morphemes) {
		const morphemeWord = item.lemma ?? item.surf;
		// Skip self-references (morpheme word === source lemma)
		if (morphemeWord === sourceWord) continue;

		const resolved = resolveMorphemePath(item, ctx);
		const targetHeader = buildMorphemeHeader(item, targetLang);
		const refLine = `[[${sourceWord}]]`;

		const transform = (content: string) => {
			const existingEntries = dictNoteHelper.parse(content);
			const matchedEntry = existingEntries.find(
				(e) => e.headerContent === targetHeader,
			);

			if (matchedEntry) {
				// Re-encounter: append attestation reference if not already present
				const attestationSection = matchedEntry.sections.find(
					(s) => s.kind === attestationCssSuffix,
				);
				if (attestationSection) {
					const hasReference = wikilinkHelper
						.parse(attestationSection.content)
						.some((wikilink) => wikilink.target === sourceWord);
					if (hasReference) {
						return content;
					}
					attestationSection.content = `${attestationSection.content.trimEnd()}\n${refLine}`;
				} else {
					matchedEntry.sections.push({
						content: refLine,
						kind: attestationCssSuffix,
						title: attestationTitle,
					});
				}

				const { body, meta } =
					dictNoteHelper.serialize(existingEntries);
				if (Object.keys(meta).length > 0) {
					return noteMetadataHelper.upsert(meta)(body) as string;
				}
				return body;
			}

			// New entry — build structured DictEntry
			const existingIds = existingEntries.map((e) => e.id);
			const prefix = dictEntryIdHelper.buildPrefix("Morphem", "Lemma");
			const entryId = dictEntryIdHelper.build({
				index: dictEntryIdHelper.nextIndex(existingIds, prefix),
				surfaceKind: "Lemma",
				unitKind: "Morphem",
			});

			const sections: EntrySection[] = [
				{
					content: buildMorphemeTagContent(item),
					kind: tagsCssSuffix,
					title: tagsTitle,
				},
				{
					content: refLine,
					kind: attestationCssSuffix,
					title: attestationTitle,
				},
			];

			const newEntry: DictEntry = {
				headerContent: targetHeader,
				id: entryId,
				meta: {},
				sections,
			};

			const allEntries = [...existingEntries, newEntry];
			const { body, meta } = dictNoteHelper.serialize(allEntries);

			if (Object.keys(meta).length > 0) {
				return noteMetadataHelper.upsert(meta)(body) as string;
			}
			return body;
		};

		propagationActions.push(...resolved.healingActions);
		propagationActions.push(
			...buildPropagationActionPair(resolved.splitPath, transform),
		);
	}

	return ok({
		...ctx,
		actions: [...ctx.actions, ...propagationActions],
	});
}
