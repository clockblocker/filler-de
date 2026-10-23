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
export { createScrollActivity } from "./resolution/scroll-activity";
export {
	observeScrollModifications,
	vamScrollFiles,
	vamUnlinkScrolls,
} from "./resolution/scroll-files";
export { createReadingReopener } from "./resolution/scroll-to-reading";
export {
	createUnlinkObserver,
	type UnlinkObserver,
} from "./resolution/unlink-observer";
export {
	filesSegmentationCache,
	HIDDEN_FOLDER,
	memorySegmentationCache,
} from "./segmentation-cache";
export { DUMGEN_SEGMENTER_VERSION } from "./sentence-key";
export { pendingUnitResolver, UnitResolverError } from "./unit-resolver";
