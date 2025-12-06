import z from "zod/v4";
import { logError } from "../../../../services/obsidian-services/helpers/issue-handlers";
import { DASH } from "../../../../types/literals";
import { NodeNameSchema } from "./guards";
import {
	intFromPageNumberString,
	PageNumberSchema,
	pageNumberFromInt,
} from "./primitives";

export const PageBasenameSchema = z.templateLiteral([
	PageNumberSchema,
	DASH,
	z.string().min(1),
]);

export type PageBasename = z.infer<typeof PageBasenameSchema>;

export const isPageBasename = (s: string): s is PageBasename =>
	PageBasenameSchema.safeParse(s).success;

export const treePathToPageBasename = z.codec(
	PageBasenameSchema,
	z.array(NodeNameSchema).min(2),
	{
		decode: (name) => {
			const [num, ...path] = name.split(DASH);
			if (!num) {
				logError({
					description: "num is undefined",
					location: "treePathToPageBasename.decode",
				});
			}
			const decodedNum = intFromPageNumberString.decode(Number(num));
			return [...path.toReversed(), decodedNum];
		},
		encode: (path) => {
			const pathCopy = [...path];
			const mbNum = pathCopy.pop();
			if (!mbNum) {
				logError({
					description: "mbNum is undefined",
					location: "treePathToPageBasename.encode",
				});
			}
			const paddedNumRepr = pageNumberFromInt.encode(
				intFromPageNumberString.encode(String(mbNum)),
			);
			return `${paddedNumRepr}${DASH}${pathCopy.toReversed().join(DASH)}` as PageBasename;
		},
	},
);
