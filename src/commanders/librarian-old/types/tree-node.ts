import z from "zod";
import type { Prettify } from "../../../types/helpers";
import {
	DONE_STATUS,
	FILE_NODE_TYPE,
	NOT_STARTED_STATUS,
	SCROLL_NODE_TYPE,
	SECTION_NODE_TYPE,
	UNKNOWN_STATUS,
} from "./literals";
import type { NodeNameDeprecated } from "./schemas/node-name";

const TreeNodeStatusSchemaDeprecated = z.enum([
	DONE_STATUS,
	NOT_STARTED_STATUS,
	UNKNOWN_STATUS,
]);

export type TreeNodeStatusDeprecated = z.infer<
	typeof TreeNodeStatusSchemaDeprecated
>;
export const TreeNodeStatusDeprecated = TreeNodeStatusSchemaDeprecated.enum;

const TreeNodeTypeSchemaDeprecated = z.enum([
	FILE_NODE_TYPE,
	SCROLL_NODE_TYPE,
	SECTION_NODE_TYPE,
]);

export type TreeNodeTypeDeprecated = z.infer<
	typeof TreeNodeTypeSchemaDeprecated
>;
export const TreeNodeTypeDeprecated = TreeNodeTypeSchemaDeprecated.enum;

/**
 * ScrollNode represents a markdown file in the tree.
 * Note: TFile references are NOT stored because they become stale when files are renamed/moved.
 * Obsidian does not automatically update TFile.path, so tRefs are resolved on-demand when needed.
 */
export type ScrollNodeDeprecated = {
	nodeName: NodeNameDeprecated;
	type: typeof TreeNodeTypeDeprecated.Scroll;
	nodeNameChainToParent: NodeNameDeprecated[];
	status: TreeNodeStatusDeprecated;
	extension: "md";
};

/**
 * FileNode represents a non-markdown file in the tree.
 * Note: TFile references are NOT stored because they become stale when files are renamed/moved.
 * Obsidian does not automatically update TFile.path, so tRefs are resolved on-demand when needed.
 */
export type FileNodeDeprecated = {
	nodeName: NodeNameDeprecated;
	type: typeof TreeNodeTypeDeprecated.File;
	nodeNameChainToParent: NodeNameDeprecated[];
	status: typeof TreeNodeStatusDeprecated.Unknown;
	extension: string;
};

export type LeafNodeDeprecated = ScrollNodeDeprecated | FileNodeDeprecated;

export type SectionNodeDeprecated = {
	nodeName: NodeNameDeprecated;
	nodeNameChainToParent: NodeNameDeprecated[];
	type: typeof TreeNodeTypeDeprecated.Section;
	status: TreeNodeStatusDeprecated;
	children: TreeNodeDeprecated[];
};

export type TreeNodeDeprecated = Prettify<
	(ScrollNodeDeprecated | FileNodeDeprecated | SectionNodeDeprecated) & {
		status: TreeNodeStatusDeprecated;
		type: TreeNodeTypeDeprecated;
	}
>;

export type TreeLeafDeprecated = ScrollNodeDeprecated | FileNodeDeprecated;
