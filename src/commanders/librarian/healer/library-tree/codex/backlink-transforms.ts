/**
 * Transforms for processing backlinks and content.
 * Used by ProcessMdFile actions to update codexes and scrolls.
 *
 * NOTE: This file re-exports from transforms/ subdirectory for backward compatibility.
 * New code should import directly from transforms/codex-transforms or transforms/scroll-transforms.
 */

export {
	makeCodexBacklinkTransform,
	makeCodexContentTransform,
	makeCodexTransform,
} from "./transforms/codex-transforms";

export {
	makeScrollBacklinkTransform,
	makeStripScrollBacklinkTransform,
} from "./transforms/scroll-transforms";
