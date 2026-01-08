import z from "zod";
import {
	EmptyStringSchema,
	MdSchema,
} from "../../../../../managers/obsidian/vault-action-manager/types/literals";
import {
	DONE_STATUS,
	FILE_NODE_TYPE,
	NOT_STARTED_STATUS,
	SCROLL_NODE_TYPE,
	SECTION_NODE_TYPE,
	UNKNOWN_STATUS,
} from "../../../types/consts/literals";

export const TreeNodeStatusSchema = z.enum([
	DONE_STATUS,
	NOT_STARTED_STATUS,
	UNKNOWN_STATUS,
]);

export type TreeNodeStatus = z.infer<typeof TreeNodeStatusSchema>;
export const TreeNodeStatus = TreeNodeStatusSchema.enum;

export const TreeNodeTypeSchema = z.enum([
	FILE_NODE_TYPE,
	SCROLL_NODE_TYPE,
	SECTION_NODE_TYPE,
]);
export type TreeNodeType = z.infer<typeof TreeNodeTypeSchema>;
export const TreeNodeType = TreeNodeTypeSchema.enum;

export const MdExtensionSchema = MdSchema;
export type MdExtension = z.infer<typeof MdExtensionSchema>;

export const FileExtensionSchema = z.string().min(1);
export type FileExtension = z.infer<typeof FileExtensionSchema>;

export const SectionExtensionSchema = EmptyStringSchema;
export type SectionExtension = z.infer<typeof SectionExtensionSchema>;

export const ExtensionSchema = z.union([
	MdExtensionSchema,
	FileExtensionSchema,
	SectionExtensionSchema,
]);

export type Extension = z.infer<typeof ExtensionSchema>;
