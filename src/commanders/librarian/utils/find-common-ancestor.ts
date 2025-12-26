import type { NodeNameChain } from "../naming/schemas/node-name";

export function findCommonAncestor(
	nodeNameChains: NodeNameChain[],
): NodeNameChain {
	if (nodeNameChains.length === 0) {
		return [];
	}

	if (nodeNameChains.length === 1) {
		return nodeNameChains[0] ?? [];
	}

	const minLength = Math.min(...nodeNameChains.map((chain) => chain.length));
	const common: NodeNameChain = [];

	for (let i = 0; i < minLength; i++) {
		const firstSegment = nodeNameChains[0]?.[i];
		if (firstSegment === undefined) {
			break;
		}
		if (nodeNameChains.every((chain) => chain[i] === firstSegment)) {
			common.push(firstSegment);
		} else {
			break;
		}
	}

	return common;
}
