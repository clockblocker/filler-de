import type { TFile } from "obsidian";
import type { SplitPath } from "../../../../obsidian-vault-action-manager/types/split-path";
import type {
	CoreName,
	CoreNameChainFromRoot,
	FileNode,
	ScrollNode,
} from "./tree-node";

/**
 * TreeLeafDto represents a leaf node (Scroll or File) with its path information.
 *
 * `pathParts` contains the full path from vault root to the file's parent folder.
 * For example, if a file is at "Library/parent/child/file.md", then:
 * - pathParts: ["Library", "parent", "child"]
 *
 * The tree automatically strips the root folder name (the first element matching
 * the Library root folder name) from pathParts, so sections are created correctly
 * relative to the root. In the example above, the tree creates sections for
 * "parent" and "child" as children of the root (which represents "Library").
 */
export type TreeLeafDto = (ScrollNode | FileNode) &
	Pick<SplitPath, "pathParts">;
