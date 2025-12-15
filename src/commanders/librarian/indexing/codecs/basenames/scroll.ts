import z from "zod/v4";
import { DASH } from "../../../../../types/literals";
import { NodeNameLegacySchemaLegacy } from "../guards";

export const ScrollBasenameSchemaLegacy = z.templateLiteral([
	z.string().min(1),
]);

export type ScrollBasename = z.infer<typeof ScrollBasenameSchemaLegacy>;

export const isScrollBasename = (s: string): s is ScrollBasename =>
	ScrollBasenameSchemaLegacy.safeParse(s).success;

export const treePathToScrollBasename = z.codec(
	ScrollBasenameSchemaLegacy,
	z.array(NodeNameLegacySchemaLegacy).min(1),
	{
		decode: (name) => {
			const treePath = name.split(DASH).toReversed();
			return treePath;
		},
		encode: (path) => {
			return path.toReversed().join(DASH) as ScrollBasename;
		},
	},
);
