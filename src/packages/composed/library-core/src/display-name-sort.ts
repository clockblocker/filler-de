import type { TreeNode } from "@textfresser/library-core/healer/library-tree/tree-node/types/tree-node";

const alphaNumericCollator = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: "base",
});

export function sortTreeNodesForDisplay(
	children: readonly TreeNode[],
): TreeNode[] {
	return [...children].sort((left, right) =>
		compareDisplayNames(left.nodeName, right.nodeName),
	);
}

export function compareDisplayNames(left: string, right: string): number {
	const leftLeadingNumber = readLeadingNumber(left);
	const rightLeadingNumber = readLeadingNumber(right);

	if (leftLeadingNumber !== null && rightLeadingNumber === null) {
		return -1;
	}
	if (leftLeadingNumber === null && rightLeadingNumber !== null) {
		return 1;
	}
	if (leftLeadingNumber !== null && rightLeadingNumber !== null) {
		const numberDiff = leftLeadingNumber - rightLeadingNumber;
		if (numberDiff !== 0) {
			return numberDiff;
		}
	}

	const alphaNumericDiff = alphaNumericCollator.compare(left, right);
	if (alphaNumericDiff !== 0) {
		return alphaNumericDiff;
	}

	return left.localeCompare(right);
}

function readLeadingNumber(value: string): number | null {
	const match = value.match(/^\d+/);
	if (!match) {
		return null;
	}

	return Number.parseInt(match[0], 10);
}
