import {
	CommandKind,
	type CommandKind as CommandKindType,
} from "../../managers/actions-manager/types";
import type { SplitPathToMdFile } from "../../managers/obsidian/vault-action-manager/types/split-path";
import { parsePageIndex } from "./bookkeeper/page-codec";
import type { Codecs } from "./codecs";

/**
 * List all commands that could be executable for a given file path.
 * Returns all possible commands for the file type; caller filters by selection state.
 *
 * @param codecs - Codecs for parsing paths and suffixes
 * @param splitPath - Path to the file
 * @returns Array of CommandKind that are applicable
 */
export function listCommandsExecutableIn(
	codecs: Codecs,
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

	// Check if it's a page
	const pageInfo = parsePageIndex(coreName);
	if (pageInfo.isPage) {
		// Page commands: navigation
		commands.push(CommandKind.GoToPrevPage);
		commands.push(CommandKind.GoToNextPage);
	} else {
		// Scroll commands: split into pages
		commands.push(CommandKind.SplitToPages);
		commands.push(CommandKind.MakeText);
	}

	// Selection-dependent commands available for any library file
	commands.push(CommandKind.SplitInBlocks);

	return commands;
}
