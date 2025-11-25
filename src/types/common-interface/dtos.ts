import { z } from "zod";

export const PathPartsSchema = z.array(z.string());
export type PathParts = z.infer<typeof PathPartsSchema>;

export const PrettyPathSchema = z.object({
	basename: z.string(),
	pathParts: PathPartsSchema,
});

export type PrettyPath = z.infer<typeof PrettyPathSchema>;
