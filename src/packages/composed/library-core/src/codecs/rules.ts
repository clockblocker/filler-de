import {
	type SplitPathToFolder,
	VaultPath,
} from "@textfresser/vault-action-manager";
import {
	type MetadataFormat,
	metadataFormatOf,
} from "../internal/root/note-metadata";
import type {
	LanguagesConfig,
	SuffixDelimiterConfig,
} from "../internal/root/plugin-types";

/**
 * The Library's settings, as library-core reads them. The plugin's parsed
 * user settings satisfy this type; library-core never reads them itself.
 */
export type LibrarySettings = {
	readonly splitPathToLibraryRoot: SplitPathToFolder;
	readonly suffixDelimiterConfig: SuffixDelimiterConfig;
	readonly suffixDelimiter: string;
	readonly suffixDelimiterPattern: RegExp;
	readonly showScrollBacklinks: boolean;
	readonly hideMetadata: boolean;
	readonly languages: LanguagesConfig;
	readonly maxSectionDepth: number;
	readonly showScrollsInCodexesForDepth: number;
};

/**
 * Codec configuration rules: one snapshot of the Library's settings.
 * Keeps library-core pure: every reader takes the rules, or the `Codecs`
 * built from them, instead of reaching for the user settings.
 */
export type CodecRules = {
	/** Suffix delimiter config (symbol + padding) */
	suffixDelimiterConfig: SuffixDelimiterConfig;
	/** Suffix delimiter canonical form (e.g., "-" or " - ") */
	suffixDelimiter: string;
	/** Suffix delimiter flexible pattern for parsing */
	suffixDelimiterPattern: RegExp;
	/** Library root name (from splitPathToLibraryRoot.basename) */
	libraryRootName: string;
	/** Full library root path parts (from splitPathToLibraryRoot.pathParts) */
	libraryRootPathParts: string[];
	/** Whether to add go-back links on scroll files */
	showScrollBacklinks: boolean;
	/**
	 * The format a Codex's metadata and a Scroll's status are written in,
	 * read as each is written. The one rule that is not a snapshot: a
	 * "Hide metadata" toggle selects the new format before it moves the
	 * notes and restarts the Librarian, so what the Librarian writes in
	 * between already lands in it.
	 */
	metadataFormat: () => MetadataFormat;
	/** User's known and target languages */
	languages: LanguagesConfig;
	/** How deep a Codex lists nested Sections (0 = own children only) */
	maxSectionDepth: number;
	/** Up to which depth a Codex lists Scrolls */
	showScrollsInCodexesForDepth: number;
};

/**
 * Creates codec rules from the Library's settings.
 * Extracts required naming conventions for codec operations. The metadata
 * format is `settings`' own unless `live` reads the one in effect.
 */
export function makeCodecRulesFromSettings(
	settings: LibrarySettings,
	live: { readonly metadataFormat?: () => MetadataFormat } = {},
): CodecRules {
	const format = metadataFormatOf(settings);
	return {
		languages: settings.languages,
		libraryRootName: settings.splitPathToLibraryRoot.basename,
		libraryRootPathParts: settings.splitPathToLibraryRoot.pathParts,
		maxSectionDepth: settings.maxSectionDepth,
		metadataFormat: live.metadataFormat ?? (() => format),
		showScrollBacklinks: settings.showScrollBacklinks,
		showScrollsInCodexesForDepth: settings.showScrollsInCodexesForDepth,
		suffixDelimiter: settings.suffixDelimiter,
		suffixDelimiterConfig: settings.suffixDelimiterConfig,
		suffixDelimiterPattern: settings.suffixDelimiterPattern,
	};
}

/** The vault path of the Library root folder, such as `Library`. */
export function libraryRootPath(rules: CodecRules): string {
	return VaultPath.join(...rules.libraryRootPathParts, rules.libraryRootName);
}

/**
 * Whether `path` lies strictly below the Library root, case-sensitively:
 * the Library Tree names nodes as Obsidian spells them. A Library rooted at
 * the vault root holds nothing, so the Librarian never heals a whole vault.
 */
export function isUnderLibraryRoot(path: string, root: string): boolean {
	return (
		root !== VaultPath.root &&
		VaultPath.caseSensitive.isUnder(path, root, { inclusive: false })
	);
}
