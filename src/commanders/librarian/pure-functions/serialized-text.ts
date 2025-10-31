import type { TextDto } from "../types";

export const toRepr = (text: TextDto) => {
	return {
		joinedPageStatuses: Object.entries(text.pageStatuses)
			.sort(([nameA, __statusA], [nameB, __statusB]) =>
				nameA.localeCompare(nameB),
			)
			.map(([__name, status]) => status)
			.join("-"),
		joinedPath: text.path.join("-"),
	};
};

export const toSortedReprs = (texts: readonly TextDto[]) => {
	const copy = [...texts];
	return [...copy]
		.map((t) => toRepr(t))
		.sort((a, b) => a.joinedPath.localeCompare(b.joinedPath));
};

export const checkEqualityOfSerializedTexts = (
	a: TextDto[],
	b: TextDto[],
): boolean => {
	const aSorted = toSortedReprs(a);
	const bSorted = toSortedReprs(b);

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
