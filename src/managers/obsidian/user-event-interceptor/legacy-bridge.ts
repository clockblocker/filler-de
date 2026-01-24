/**
 * LegacyBridge - bridges new behavior chain to old subscribe pattern.
 *
 * Registers behaviors that convert new payloads to old UserEvents
 * and emit them to legacy subscribers.
 *
 * This allows gradual migration from subscribe pattern to behavior chain.
 */

import type { EditorView } from "@codemirror/view";
import { type BehaviorRegistry, getBehaviorRegistry } from "./behavior-chain";
import type { CheckboxPayload } from "./events/click/checkbox/payload";
import type { CheckboxFrontmatterPayload } from "./events/click/checkbox-frontmatter/payload";
import type { ClipboardPayload } from "./events/clipboard/payload";
import type { SelectAllPayload } from "./events/select-all/payload";
import type { WikilinkPayload } from "./events/wikilink/payload";
import type { BehaviorRegistration } from "./types/behavior";
import { PayloadKind } from "./types/payload-base";
import { TransformKind } from "./types/transform-kind";
import type {
	CheckboxClickedEvent,
	ClipboardCopyEvent,
	PropertyCheckboxClickedEvent,
	SelectAllEvent,
	UserEvent,
	UserEventHandler,
	WikilinkCompletedEvent,
} from "./types/user-event";
import { InterceptableUserEventKind } from "./types/user-event";

/**
 * Priority for legacy bridge behaviors.
 * Set to 100 (high number = runs late) so real behaviors run first.
 */
const LEGACY_BRIDGE_PRIORITY = 100;

/**
 * LegacyBridge manages the subscribe pattern for backward compatibility.
 */
export class LegacyBridge {
	private readonly subscribers = new Set<UserEventHandler>();
	private readonly unregisterFns: (() => void)[] = [];

	constructor(private readonly registry: BehaviorRegistry) {}

	/**
	 * Subscribe to user events (legacy pattern).
	 * Returns teardown function.
	 */
	subscribe(handler: UserEventHandler): () => void {
		this.subscribers.add(handler);
		return () => this.subscribers.delete(handler);
	}

	/**
	 * Register all legacy bridge behaviors.
	 */
	registerBridgeBehaviors(): void {
		// Clipboard bridge
		this.unregisterFns.push(
			this.registry.register(
				PayloadKind.ClipboardCopy,
				this.createClipboardBridge(),
			),
		);

		// Checkbox bridge
		this.unregisterFns.push(
			this.registry.register(
				PayloadKind.CheckboxClicked,
				this.createCheckboxBridge(),
			),
		);

		// Checkbox frontmatter bridge
		this.unregisterFns.push(
			this.registry.register(
				PayloadKind.CheckboxInFrontmatterClicked,
				this.createCheckboxFrontmatterBridge(),
			),
		);

		// Select-all bridge
		this.unregisterFns.push(
			this.registry.register(
				PayloadKind.SelectAll,
				this.createSelectAllBridge(),
			),
		);

		// Wikilink bridge
		this.unregisterFns.push(
			this.registry.register(
				PayloadKind.WikilinkCompleted,
				this.createWikilinkBridge(),
			),
		);
	}

	/**
	 * Unregister all bridge behaviors.
	 */
	unregisterBridgeBehaviors(): void {
		for (const fn of this.unregisterFns) {
			fn();
		}
		this.unregisterFns.length = 0;
	}

	/**
	 * Clear all subscribers.
	 */
	clearSubscribers(): void {
		this.subscribers.clear();
	}

	// ─── Bridge Behaviors ───

	private createClipboardBridge(): BehaviorRegistration<ClipboardPayload> {
		return {
			id: "legacy-bridge:clipboard",
			isApplicable: () => this.subscribers.size > 0,
			priority: LEGACY_BRIDGE_PRIORITY,
			transform: (ctx) => {
				// Store reference to clipboardData setter for legacy event
				let preventDefaultCalled = false;
				let clipboardText: string | null = null;

				const legacyEvent: ClipboardCopyEvent = {
					isCut: ctx.data.isCut,
					kind: InterceptableUserEventKind.ClipboardCopy,
					originalText: ctx.data.originalText,
					preventDefault: () => {
						preventDefaultCalled = true;
					},
					setClipboardData: (text: string) => {
						clipboardText = text;
					},
				};

				this.emit(legacyEvent);

				// If legacy handler modified clipboard, update payload
				if (clipboardText !== null) {
					return {
						data: { ...ctx.data, modifiedText: clipboardText },
						kind: TransformKind.continue,
					};
				}

				// If legacy handler called preventDefault but didn't set text, skip
				if (preventDefaultCalled && clipboardText === null) {
					return { kind: TransformKind.skip };
				}

				return { kind: TransformKind.proceedWithDefault };
			},
		};
	}

	private createCheckboxBridge(): BehaviorRegistration<CheckboxPayload> {
		return {
			id: "legacy-bridge:checkbox",
			isApplicable: () => this.subscribers.size > 0,
			priority: LEGACY_BRIDGE_PRIORITY,
			transform: (ctx) => {
				const legacyEvent: CheckboxClickedEvent = {
					checked: ctx.data.checked,
					kind: InterceptableUserEventKind.CheckboxClicked,
					lineContent: ctx.data.lineContent,
					splitPath: ctx.data.splitPath,
				};

				this.emit(legacyEvent);
				return { kind: TransformKind.proceedWithDefault };
			},
		};
	}

	private createCheckboxFrontmatterBridge(): BehaviorRegistration<CheckboxFrontmatterPayload> {
		return {
			id: "legacy-bridge:checkbox-frontmatter",
			isApplicable: () => this.subscribers.size > 0,
			priority: LEGACY_BRIDGE_PRIORITY,
			transform: (ctx) => {
				const legacyEvent: PropertyCheckboxClickedEvent = {
					checked: ctx.data.checked,
					kind: InterceptableUserEventKind.PropertyCheckboxClicked,
					propertyName: ctx.data.propertyName,
					splitPath: ctx.data.splitPath,
				};

				this.emit(legacyEvent);
				return { kind: TransformKind.proceedWithDefault };
			},
		};
	}

	private createSelectAllBridge(): BehaviorRegistration<SelectAllPayload> {
		return {
			id: "legacy-bridge:select-all",
			isApplicable: () => this.subscribers.size > 0,
			priority: LEGACY_BRIDGE_PRIORITY,
			transform: (ctx) => {
				let preventDefaultCalled = false;
				let customSelection: { from: number; to: number } | null = null;

				const legacyEvent: SelectAllEvent = {
					content: ctx.data.content,
					kind: InterceptableUserEventKind.SelectAll,
					preventDefault: () => {
						preventDefaultCalled = true;
					},
					setSelection: (from: number, to: number) => {
						customSelection = { from, to };
					},
					view: ctx.data.view,
				};

				this.emit(legacyEvent);

				// If legacy handler set custom selection, update payload
				if (customSelection !== null) {
					return {
						data: { ...ctx.data, customSelection },
						kind: TransformKind.continue,
					};
				}

				// If legacy handler called preventDefault but didn't set selection, skip
				if (preventDefaultCalled && customSelection === null) {
					return { kind: TransformKind.skip };
				}

				return { kind: TransformKind.proceedWithDefault };
			},
		};
	}

	private createWikilinkBridge(): BehaviorRegistration<WikilinkPayload> {
		return {
			id: "legacy-bridge:wikilink",
			isApplicable: () => this.subscribers.size > 0,
			priority: LEGACY_BRIDGE_PRIORITY,
			transform: (ctx) => {
				let aliasToInsert: string | null = null;

				const legacyEvent: WikilinkCompletedEvent = {
					closePos: ctx.data.closePos,
					insertAlias: (alias: string) => {
						aliasToInsert = alias;
					},
					kind: InterceptableUserEventKind.WikilinkCompleted,
					linkContent: ctx.data.linkContent,
				};

				this.emit(legacyEvent);

				// If legacy handler wants to insert alias, update payload
				if (aliasToInsert !== null) {
					return {
						data: { ...ctx.data, aliasToInsert },
						kind: TransformKind.continue,
					};
				}

				return { kind: TransformKind.proceedWithDefault };
			},
		};
	}

	private emit(event: UserEvent): void {
		for (const handler of this.subscribers) {
			try {
				handler(event);
			} catch (error) {
				// Silently ignore errors from legacy handlers
			}
		}
	}
}

/**
 * Create a legacy bridge with the global behavior registry.
 */
export function createLegacyBridge(): LegacyBridge {
	return new LegacyBridge(getBehaviorRegistry());
}
