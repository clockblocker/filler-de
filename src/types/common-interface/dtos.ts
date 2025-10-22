import { z } from "zod";
import { FileTypeSchema } from "./enums";

export type PathParts = string[];
export type PrettyPath = { pathParts: PathParts; title: string }; // PathParts.join('/')/title.md

export const MetaInfoSchema = z.object({
	fileType: FileTypeSchema,
});

export type MetaInfo = z.infer<typeof MetaInfoSchema>;

export type PrettyFile = {
	prettyPath: PrettyPath;
	metaInfo: MetaInfo;
};
