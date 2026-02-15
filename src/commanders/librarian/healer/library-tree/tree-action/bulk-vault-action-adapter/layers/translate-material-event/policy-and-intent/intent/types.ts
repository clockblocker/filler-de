import z from "zod";
import { TreeActionType } from "../../../../../types/tree-action";

export const RenameIntentSchema = z.enum([
	TreeActionType.Move,
	TreeActionType.Rename,
]);
export const RenameIntent = RenameIntentSchema.enum;
export type RenameIntent = z.infer<typeof RenameIntentSchema>;
