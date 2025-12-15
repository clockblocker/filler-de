import z from "zod/v4";
import { logError } from "../../../../../obsidian-vault-action-manager/helpers/issue-handlers";
import { DASH } from "../../../../../types/literals";
import { NodeNameLegacySchemaLegacy } from "../guards";
import {
	intFromPageNumberStringLegacy,
	PageNumberSchemaLegacy,
	pageNumberFromInt,
} from "../primitives";

export const PageBasenameLegacySchemaLegacy = z.templateLiteral([
	PageNumberSchemaLegacy,
	DASH,
	z.string().min(1),
]);

export type PageBasenameLegacy = z.infer<typeof PageBasenameLegacySchemaLegacy>;

export const isPageBasenameLegacy = (s: string): s is PageBasenameLegacy =>
	PageBasenameLegacySchemaLegacy.safeParse(s).success;

export const treePathToPageBasenameLegacy = z.codec(
	PageBasenameLegacySchemaLegacy,
	z.array(NodeNameLegacySchemaLegacy).min(2),
	{
		decode: (name) => {
			const [num, ...path] = name.split(DASH);
			if (!num) {
				logError({
					description: "num is undefined",
					location: "treePathToPageBasenameLegacy.decode",
				});
			}
			const decodedNum = intFromPageNumberStringLegacy.decode(
				Number(num),
			);
			return [...path.toReversed(), decodedNum];
		},
		encode: (path) => {
			const pathCopy = [...path];
			const mbNum = pathCopy.pop();
			if (!mbNum) {
				logError({
					description: "mbNum is undefined",
					location: "treePathToPageBasenameLegacy.encode",
				});
			}
			const paddedNumRepr = pageNumberFromInt.encode(
				intFromPageNumberStringLegacy.encode(String(mbNum)),
			);
			return `${paddedNumRepr}${DASH}${pathCopy.toReversed().join(DASH)}` as PageBasenameLegacy;
		},
	},
);
