/**
 * Events module - exports all event types, codecs, and detectors.
 */

// Click events - action element
export { ActionElementCodec } from "./click/action-element/codec";
export { ActionElementDetector } from "./click/action-element/detector";
export type { ActionElementPayload } from "./click/action-element/payload";

// Click events - checkbox
export { CheckboxCodec } from "./click/checkbox/codec";
export { CheckboxClickedDetector } from "./click/checkbox/detector";
export type { CheckboxPayload } from "./click/checkbox/payload";

// Click events - checkbox frontmatter
export { CheckboxFrontmatterCodec } from "./click/checkbox-frontmatter/codec";
export { CheckboxFrontmatterDetector } from "./click/checkbox-frontmatter/detector";
export type { CheckboxFrontmatterPayload } from "./click/checkbox-frontmatter/payload";

// Click events - generic
export type { RawClickHandler } from "./click/generic-click-detector";
export { GenericClickDetector } from "./click/generic-click-detector";

// Click events - wikilink click
export { WikilinkClickCodec } from "./click/wikilink-click/codec";
export { WikilinkClickDetector } from "./click/wikilink-click/detector";
export type { WikilinkClickPayload } from "./click/wikilink-click/payload";

// Clipboard events
export { ClipboardCodec } from "./clipboard/codec";
export { ClipboardDetector } from "./clipboard/detector";
export type { ClipboardPayload } from "./clipboard/payload";
export {
	ClipboardPayloadSchema,
	createClipboardPayload,
} from "./clipboard/payload";

// Select-all events
export { SelectAllCodec } from "./select-all/codec";
export { SelectAllDetector } from "./select-all/detector";
export type { SelectAllPayload } from "./select-all/payload";
export { createSelectAllPayload } from "./select-all/payload";

// Selection changed events
export { SelectionChangedCodec } from "./selection-changed/codec";
export { SelectionChangedDetector } from "./selection-changed/detector";
export type { SelectionChangedPayload } from "./selection-changed/payload";
export {
	createSelectionChangedPayload,
	SelectionChangedPayloadSchema,
} from "./selection-changed/payload";

// Wikilink events
export { WikilinkCodec } from "./wikilink/codec";
export { WikilinkDetector } from "./wikilink/detector";
export type { WikilinkPayload } from "./wikilink/payload";
export { createWikilinkPayload } from "./wikilink/payload";
