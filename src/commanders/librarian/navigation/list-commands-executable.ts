import type { Codecs, Healer } from "@textfresser/library-core";
import { isCodexSplitPath } from "@textfresser/library-core";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import { Result } from "effect";
import {
	CommandKind,
	type CommandKind as CommandKindType,
} from "../../../managers/obsidian/command-executor";
import { parsePageIndex } from "../pages/page-codec";
import {
	getNextPage as getNextPageImpl,
	getPrevPage as getPrevPageImpl,
} from "./page-navigation";

/**
 * List all commands that could be executable for a given file path.
 * Returns all possible commands for the file type; caller filters by selection state.
 *
 * @param codecs - Codecs for parsing paths and suffixes
 * @param healer - Healer for tree-based edge detection (nullable during init)
 * @param splitPath - Library-scoped path to the file. The caller (Librarian)
 *   has already checked that the vault path is inside the Library.
 * @returns Array of CommandKind that are applicable
 */
export function listCommandsExecutableIn(
	codecs: Codecs,
	healer: Healer | null,
	splitPath: SplitPathToMdFile,
): CommandKindType[] {
	const commands: CommandKindType[] = [];

	// Parse suffix to get coreName for page detection
	const parsedSuffix = codecs.suffix.parseSeparatedSuffix(splitPath.basename);
	if (Result.isFailure(parsedSuffix)) {
		// Not a valid library file, return empty
		return [];
	}

	const { coreName } = parsedSuffix.success;

	if (healer && getPrevPageImpl(healer, codecs, splitPath) !== null) {
		commands.push(CommandKind.GoToPrevPage);
	}
	if (healer && getNextPageImpl(healer, codecs, splitPath) !== null) {
		commands.push(CommandKind.GoToNextPage);
	}

	// Scroll commands: split into pages, but don't offer it for generated page files.
	if (!isCodexSplitPath(splitPath) && !parsePageIndex(coreName).isPage) {
		commands.push(CommandKind.SplitToPages);
	}

	// Selection-dependent commands available for any library file
	commands.push(CommandKind.SplitInBlocks);

	return commands;
}
