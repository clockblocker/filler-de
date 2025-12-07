import z from "zod/v4";
import { DASH, UnderscoreSchema } from "../../../../../types/literals";
import { NodeNameSchema } from "../guards";

export const CodexBaseameSchema = z.templateLiteral([
	UnderscoreSchema,
	UnderscoreSchema,
	z.string().min(1),
]);

export type CodexBaseame = z.infer<typeof CodexBaseameSchema>;

export const isCodexBasename = (s: string): s is CodexBaseame =>
	CodexBaseameSchema.safeParse(s).success;

export const treePathToCodexBasename = z.codec(
	CodexBaseameSchema,
	z.array(NodeNameSchema).min(1),
	{
		decode: (s) => s.slice(2).split(DASH).toReversed(),
		encode: (path) => `__${path.toReversed().join(DASH)}` as CodexBaseame,
	},
);
