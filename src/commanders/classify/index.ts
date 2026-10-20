/**
 * Classify (#63): segmentation over a selection, handing a `ClassifyPlan`
 * of `UnitRef`s to the `UnitResolver` port (`unit-resolver.ts`), which
 * `dumgenUnitResolver` (`resolution/`, #64) implements.
 */
export { ClassifyCommander } from "./classify-commander";
export { dumgenUnitResolver } from "./resolution/dumgen-unit-resolver";
export {
	createKnowledgeQueue,
	type KnowledgeQueue,
} from "./resolution/knowledge-queue";
export { produceKnowledge } from "./resolution/produce-knowledge";
export { vamScrollFiles } from "./resolution/scroll-files";
export { scrollAfterKnowledge } from "./resolution/scroll-to-reading";
export {
	filesSegmentationCache,
	memorySegmentationCache,
} from "./segmentation-cache";
export { DUMGEN_SEGMENTER_VERSION } from "./sentence-key";
export { pendingUnitResolver, UnitResolverError } from "./unit-resolver";
