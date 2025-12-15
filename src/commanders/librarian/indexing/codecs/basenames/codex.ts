import z from "zod/v4";
import { DASH, UnderscoreSchema } from "../../../../../types/literals";
import { NodeNameLegacySchemaLegacy } from "../guards";

export const CodexBaseameSchemaLegacy = z.templateLiteral([
	UnderscoreSchema,
	UnderscoreSchema,
	z.string().min(1),
]);

export type CodexBaseame = z.infer<typeof CodexBaseameSchemaLegacy>;

export const isCodexBasenameLegacy = (s: string): s is CodexBaseame =>
	CodexBaseameSchemaLegacy.safeParse(s).success;

export const treePathToCodexBasename = z.codec(
	CodexBaseameSchemaLegacy,
	z.array(NodeNameLegacySchemaLegacy).min(1),
	{
		decode: (s) => s.slice(2).split(DASH).toReversed(),
		encode: (path) => `__${path.toReversed().join(DASH)}` as CodexBaseame,
	},
);
