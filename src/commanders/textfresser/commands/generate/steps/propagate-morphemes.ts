/**
 * Propagate morpheme back-references to target notes.
 *
 * For each morpheme in a multi-morpheme word, creates an attestation
 * back-reference on the morpheme's target note (e.g., prefix note in Library,
 * or root/suffix note in Wörter).
 *
 * Skips single-morpheme words (simple roots like "Hand") since there's nothing
 * to cross-reference.
 */

import { ok, type Result } from "neverthrow";
import { SurfaceKind } from "../../../../../linguistics/common/enums/core";
import { cssSuffixFor } from "../../../../../linguistics/common/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../../linguistics/common/sections/section-kind";
import type { VaultAction } from "../../../../../managers/obsidian/vault-action-manager";
import {
	SplitPathKind,
	type SplitPathToMdFile,
} from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { MorphemeItem } from "../../../../../stateless-helpers/morpheme-formatter";
import {
	buildPropagationActionPair,
	resolveTargetPath,
} from "../../../common/target-path-resolver";
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

/**
 * For each morpheme in a multi-morpheme word, generate actions that append
 * a back-reference attestation line to the morpheme's target note.
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
	const sectionMarker = `<span class="entry_section_title entry_section_title_${attestationCssSuffix}">${attestationTitle}</span>`;

	const propagationActions: VaultAction[] = [];

	for (const item of morphemes) {
		const morphemeWord = item.lemma ?? item.surf;
		// Skip self-references (morpheme word === source lemma)
		if (morphemeWord === sourceWord) continue;

		const resolved = resolveMorphemePath(item, ctx);
		const refLine = `[[${sourceWord}]]`;

		const transform = (content: string) => {
			// Already has this back-reference — skip
			if (content.includes(refLine)) return content;

			// Check if attestation section marker exists
			if (content.includes(sectionMarker)) {
				const markerIdx = content.indexOf(sectionMarker);
				const afterMarker = markerIdx + sectionMarker.length;
				const rest = content.slice(afterMarker);

				// Find end of current section (next section marker or end)
				const nextSectionMatch = rest.match(
					/<span class="entry_section_title /,
				);
				const insertPoint = nextSectionMatch?.index
					? afterMarker + nextSectionMatch.index
					: content.length;

				return (
					content.slice(0, insertPoint).trimEnd() +
					"\n" +
					refLine +
					content.slice(insertPoint)
				);
			}

			// No attestation section — append one at the end
			return `${content.trimEnd()}\n${sectionMarker}\n${refLine}`;
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
