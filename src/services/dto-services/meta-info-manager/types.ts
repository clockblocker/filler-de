import z from "zod";
import {
	FileType,
	LibraryMdFileSubTypeSchema,
	TextStatusSchema,
} from "../../../types/common-interface/enums";

export const MetaInfoSchema = z.discriminatedUnion("fileType", [
	z.object({
		fileType: LibraryMdFileSubTypeSchema,
		status: TextStatusSchema,
	}),
	z.object({ fileType: FileType.Entry }),
]);

export type MetaInfo = z.infer<typeof MetaInfoSchema>;
