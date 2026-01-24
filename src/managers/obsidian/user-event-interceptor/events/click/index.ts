/**
 * Click event module exports.
 */

export { ActionElementCodec } from "./action-element/codec";
// Action element ([data-action] buttons)
export { ActionElementDetector } from "./action-element/detector";
export type { ActionElementPayload } from "./action-element/payload";
export { CheckboxCodec } from "./checkbox/codec";
// Checkbox (task checkbox in content)
export { CheckboxClickedDetector } from "./checkbox/detector";
export type { CheckboxPayload } from "./checkbox/payload";
export { CheckboxFrontmatterCodec } from "./checkbox-frontmatter/codec";
// Checkbox in frontmatter (property checkbox)
export { CheckboxFrontmatterDetector } from "./checkbox-frontmatter/detector";
export type { CheckboxFrontmatterPayload } from "./checkbox-frontmatter/payload";
export type { RawClickHandler } from "./generic-click-detector";
export { GenericClickDetector } from "./generic-click-detector";
