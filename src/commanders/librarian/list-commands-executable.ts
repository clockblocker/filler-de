import {
	CommandKind,
	type CommandKind as CommandKindType,
} from "../../managers/obsidian/command-executor";
import type { SplitPathToMdFile } from "../../managers/obsidian/vault-action-manager/types/split-path";
import { parsePageIndex } from "./bookkeeper/page-codec";
import type { Codecs } from "./codecs";
import type { Healer } from "./healer/healer";
import { isCodexSplitPath } from "./healer/library-tree/codex/helpers";
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
 * @param splitPath - Path to the file
 * @returns Array of CommandKind that are applicable
 */
export function listCommandsExecutableIn(
	codecs: Codecs,
	healer: Healer | null,
	splitPath: SplitPathToMdFile,
): CommandKindType[] {
	// Check if inside library
	if (!codecs.splitPathInsideLibrary.checkIfInsideLibrary(splitPath)) {
		return [];
	}

	const commands: CommandKindType[] = [];

	// Parse suffix to get coreName for page detection
	const parsedSuffix = codecs.suffix.parseSeparatedSuffix(splitPath.basename);
	if (parsedSuffix.isErr()) {
		// Not a valid library file, return empty
		return [];
	}

	const { coreName } = parsedSuffix.value;

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
