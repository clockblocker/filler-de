/**
 * Classify (#63): segmentation over a selection, handing a `ClassifyPlan`
 * of `UnitRef`s to the `UnitResolver` port (`unit-resolver.ts`), which
 * resolution (#64) implements.
 */
export { ClassifyCommander } from "./classify-commander";
export {
	filesSegmentationCache,
	memorySegmentationCache,
} from "./segmentation-cache";
export { DUMGEN_SEGMENTER_VERSION } from "./sentence-key";
export { pendingUnitResolver } from "./unit-resolver";
