import { z } from "zod";
import type { Prettify } from "../../helpers";

export const PathPartsSchema = z.array(z.string());
export type PathParts = z.infer<typeof PathPartsSchema>;

export const PrettyPathLegacySchema = z.object({
	basename: z.string(),
	pathParts: PathPartsSchema,
});

export type PrettyPathLegacy = z.infer<typeof PrettyPathLegacySchema>;

// Types previously exported from background-file-service.ts
export type PrettyFileDto = Prettify<
	PrettyPathLegacy & {
		content?: string;
	}
>;

export type PrettyFileFromTo = {
	from: PrettyFileDto;
	to: PrettyFileDto;
};

export type ReadablePrettyFile = Prettify<
	PrettyPathLegacy & {
		readContent: () => Promise<string>;
	}
>;
