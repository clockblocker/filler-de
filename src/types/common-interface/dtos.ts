import { z } from "zod";
import { FileTypeSchema } from "./enums";

export type PathParts = string[];
export type PrettyPath =
	| { type: "folder"; pathParts: PathParts; title: string }
	| { type: "file"; pathParts: PathParts; title: string; extension: string }; // {PathParts.join('/')}/{title}.{extension}

export const MetaInfoSchema = z.object({
	fileType: FileTypeSchema,
});

export type MetaInfo = z.infer<typeof MetaInfoSchema>;

export type PrettyFile = {
	prettyPath: PrettyPath;
	metaInfo: MetaInfo;
};
