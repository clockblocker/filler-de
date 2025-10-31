import z from "zod";
import {
	LibraryMdFileSubTypeSchema,
	TextStatusSchema,
} from "../../../types/common-interface/enums";
import { ENTRY } from "../../../types/literals";

export const MetaInfoSchema = z.discriminatedUnion("fileType", [
	z.object({
		fileType: LibraryMdFileSubTypeSchema,
		status: TextStatusSchema,
	}),
	z.object({ fileType: z.literal(ENTRY) }),
]);

export type MetaInfo = z.infer<typeof MetaInfoSchema>;
