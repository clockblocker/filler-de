import type * as Dumling from "dumling/types";

/** The vault folder every dictionary note lives under. */
export const WORTER_FOLDER = "Worter";

export const MARKDOWN_EXTENSION = ".md";

/** A note's vault location: its folder chain, its basename and both joined. */
export type NotePath = {
	readonly folders: readonly string[];
	readonly basename: string;
	/** `folders/basename.md`, relative to the vault root. */
	readonly path: string;
};

/** The fields of a Lemma its path spells. */
export type PathLemma = Pick<
	Dumling.Lemma<"de">,
	"language" | "family" | "kind" | "canonicalForm" | "coreFeatures"
> & { readonly syncretic?: readonly string[] };

/** A path no dictionary note has, with the reason. */
export type InvalidNotePath = {
	readonly _tag: "InvalidNotePath";
	readonly path: string;
	readonly reason: string;
};

export function notePath(
	folders: readonly string[],
	basename: string,
): NotePath {
	return {
		basename,
		folders,
		path: `${[...folders, basename].join("/")}${MARKDOWN_EXTENSION}`,
	};
}
