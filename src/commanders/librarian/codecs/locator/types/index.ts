import type z from "zod";
import type { TreeNodeKind } from "../../../healer/library-tree/tree-node/types/atoms";

import type {
	FileNodeLocatorSchema,
	ScrollNodeLocatorSchema,
	SectionNodeLocatorSchema,
	TreeNodeLocatorSchema,
} from "./schemas";

export type SectionNodeLocator = z.infer<typeof SectionNodeLocatorSchema>;
export type ScrollNodeLocator = z.infer<typeof ScrollNodeLocatorSchema>;
export type FileNodeLocator = z.infer<typeof FileNodeLocatorSchema>;
export type TreeNodeLocator = z.infer<typeof TreeNodeLocatorSchema>;

export type AnyNodeLocator =
	| SectionNodeLocator
	| ScrollNodeLocator
	| FileNodeLocator;

export type NodeLocatorOf<NK extends TreeNodeKind> = Extract<
	TreeNodeLocator,
	{ targetKind: NK }
>;

// Re-export schemas
export {
	BaseNodeLocatorSchema,
	FileNodeLocatorSchema,
	ScrollNodeLocatorSchema,
	SectionNodeLocatorSchema,
	TreeNodeLocatorSchema,
} from "./schemas";
