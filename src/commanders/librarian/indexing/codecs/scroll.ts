import z from "zod/v4";
import { DASH } from "../../../../types/literals";
import { NodeNameSchema } from "./guards";

export const ScrollBasenameSchema = z.templateLiteral([z.string().min(1)]);

export type ScrollBasename = z.infer<typeof ScrollBasenameSchema>;

export const isScrollBasename = (s: string): s is ScrollBasename =>
	ScrollBasenameSchema.safeParse(s).success;

export const treePathToScrollBasename = z.codec(
	ScrollBasenameSchema,
	z.array(NodeNameSchema).min(2),
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
