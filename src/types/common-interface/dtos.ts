import { z } from "zod";
import { FileTypeSchema } from "./enums";

export type PathParts = string[];
export type SplitPathToMdFile = {
	pathParts: PathParts;
	basename: string;
};

export const MetaInfoSchema = z.object({
	fileType: FileTypeSchema,
});

export type MetaInfo = z.infer<typeof MetaInfoSchema>;

export type WipPrettyFile = {
	prettyPath: SplitPathToMdFile;
	metaInfo: MetaInfo;
};
