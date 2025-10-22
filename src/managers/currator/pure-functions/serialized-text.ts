import type { SerializedText } from "../types";

export const sortSerializedTexts = (texts: SerializedText[]) =>
	[...texts]
		.map((t) => ({
			joinedPath: t.path.join("-"),
			joinedPageStatuses: [...t.pageStatuses].sort().join("-"),
		}))
		.sort((a, b) => a.joinedPath.localeCompare(b.joinedPath));

export const checkEqualityOfSerializedTexts = (
	a: SerializedText[],
	b: SerializedText[],
): boolean => {
	const aSorted = sortSerializedTexts(a);
	const bSorted = sortSerializedTexts(b);

	if (aSorted.length !== bSorted.length) return false;

	for (let i = 0; i < aSorted.length; i++) {
		if (
			aSorted[i]?.joinedPath !== bSorted[i]?.joinedPath ||
			aSorted[i]?.joinedPageStatuses !== bSorted[i]?.joinedPageStatuses
		) {
			return false;
		}
	}
	return true;
};
