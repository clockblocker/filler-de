export { type NoteDiff, type NoteSnapshot, noteDiffer } from "./note-differ";
export {
	type GetNodeFn,
	mapDiffToActions,
	regenerateCodexActions,
	TreeDiffApplier, // deprecated, kept for backward compatibility
} from "./tree-diff-applier";
