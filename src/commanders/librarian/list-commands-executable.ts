import {
	UserCommandKind as UserCommand,
	type UserCommandKind,
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
 * @returns Array of UserCommandKind that are applicable
 */
export function listCommandsExecutableIn(
	codecs: Codecs,
	splitPath: SplitPathToMdFile,
): UserCommandKind[] {
	// Check if inside library
	if (!codecs.splitPathInsideLibrary.checkIfInsideLibrary(splitPath)) {
		return [];
	}

	const commands: UserCommandKind[] = [];

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
		commands.push(UserCommand.NavigatePage);
		commands.push(UserCommand.PreviousPage);
	} else {
		// Scroll commands: split into pages
		commands.push(UserCommand.SplitToPages);
		commands.push(UserCommand.MakeText);
	}

	// Selection-dependent commands available for any library file
	commands.push(UserCommand.SplitInBlocks);

	return commands;
}
