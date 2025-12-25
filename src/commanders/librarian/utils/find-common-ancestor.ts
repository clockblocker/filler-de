import type { CoreNameChainFromRoot } from "../naming/parsed-basename";

export function findCommonAncestor(
	coreNameChains: CoreNameChainFromRoot[],
): CoreNameChainFromRoot {
	if (coreNameChains.length === 0) {
		return [];
	}

	if (coreNameChains.length === 1) {
		return coreNameChains[0] ?? [];
	}

	const minLength = Math.min(...coreNameChains.map((chain) => chain.length));
	const common: CoreNameChainFromRoot = [];

	for (let i = 0; i < minLength; i++) {
		const firstSegment = coreNameChains[0]?.[i];
		if (firstSegment === undefined) {
			break;
		}
		if (coreNameChains.every((chain) => chain[i] === firstSegment)) {
			common.push(firstSegment);
		} else {
			break;
		}
	}

	return common;
}
