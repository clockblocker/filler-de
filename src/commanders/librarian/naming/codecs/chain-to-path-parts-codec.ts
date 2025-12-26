import z from "zod";
import { getParsedUserSettings } from "../../../../global-state/global-state";
import { PathPartsSchema } from "../../../../obsidian-vault-action-manager/types/split-path";
import { NodeNameChainSchema } from "../parsed-basename";

export const pathPartsToNodeNameChainCodec = z.codec(
	PathPartsSchema,
	NodeNameChainSchema,
	{
		decode: (pathParts) => {
			return pathParts.slice(1);
		},
		encode: (chain) => {
			const settings = getParsedUserSettings();
			const libraryRoot = settings.splitPathToLibraryRoot.basename;

			return [libraryRoot, ...chain];
		},
	},
);

export const nodeNameChainToPathPartsCodec = z.codec(
	NodeNameChainSchema,
	PathPartsSchema,
	{
		decode: (chain) => {
			const settings = getParsedUserSettings();
			const libraryRoot = settings.splitPathToLibraryRoot.basename;

			return [libraryRoot, ...chain];
		},
		encode: (pathParts) => {
			return pathParts.slice(1);
		},
	},
);
