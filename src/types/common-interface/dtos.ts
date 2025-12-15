import { z } from "zod";

export const PathPartsSchema = z.array(z.string());
export type PathParts = z.infer<typeof PathPartsSchema>;

export const PrettyPathLegacySchema = z.object({
	basename: z.string(),
	pathParts: PathPartsSchema,
});

export type PrettyPathLegacy = z.infer<typeof PrettyPathLegacySchema>;
