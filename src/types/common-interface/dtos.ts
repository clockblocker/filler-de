import { z } from "zod";
import { FileTypeSchema } from "./enums";

export type PathParts = string[];

export type PrettyPathFolder = {
	type: "folder";
	pathParts: PathParts;
	basename: string;
};

export type PrettyPathFile = {
	type: "file";
	pathParts: PathParts;
	basename: string;
	extension: "md" | string;
};

export type PrettyPath = PrettyPathFolder | PrettyPathFile;

export const MetaInfoSchema = z.object({
	fileType: FileTypeSchema,
});

export type MetaInfo = z.infer<typeof MetaInfoSchema>;

export type PrettyFile = {
	prettyPath: PrettyPath;
	metaInfo: MetaInfo;
};
