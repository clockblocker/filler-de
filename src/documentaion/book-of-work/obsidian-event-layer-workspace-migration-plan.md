# Obsidian Event Layer Workspace Migration Plan

## Goal

Extract the current `user-event-interceptor/` subsystem into a workspace-ready package at `src/packages/obsidian-event-layer`.

The end state is:

- `textfresser` consumes user-event infrastructure only through a tiny facade
- the package owns DOM/editor interception, event normalization, and native-event application details
- app code owns business behavior only
- no consumer imports detectors, codecs, DOM selectors, or package internals
- public payloads are plain data objects, not `EditorView`, `HTMLElement`, `App`, or `VaultActionManager`

This extraction is worth doing only if the boundary is made clean first. The main value is architectural enforcement, not runtime behavior.

## Locked Decisions

### Boundary ownership

- `obsidian-event-layer` is explicitly Obsidian-specific; making it framework-agnostic is not a goal
- the package owns event capture for markdown user interactions:
  - clipboard copy/cut
  - task checkbox clicks
  - frontmatter checkbox clicks
  - action-element clicks
  - smart select-all
  - wikilink completion
  - wikilink click
  - selection changed
- the package owns translation from raw DOM/editor state into plain event payloads
- the package owns native side-effect application for handled effects:
  - writing modified clipboard text
  - applying custom selection
  - inserting wikilink alias / replacing wikilink target
  - restoring Obsidian navigation when a handler returns passthrough after interception
- `textfresser` owns all business decisions and commander delegation
- `behavior-manager/` remains in app code; it should depend on the package facade, not the package internals
- `workspace-navigation-event-interceptor/` stays separate for now; this plan covers user events only

### Public contract direction

The intended public API stays small:

- `createObsidianEventLayer()`
- `UserEventKind`
- plain payload types
- `UserEventHandler`
- `UserEventResult`
- `Teardown`

The public API must not export:

- detectors
- codecs
- Zod schemas
- `GenericClickDetector`
- DOM selector helpers
- idle-tracker helpers
- raw Obsidian editor/view elements in payloads

### Event coverage

- `selectionChanged` stays in the public API
- it already fits the intended boundary well:
  - plain data payload
  - no effect result needed
  - real app consumer exists in `OverlayManager`

### Registration model

- v1 keeps the current one-handler-per-event-kind contract
- multi-handler composition is not part of the package boundary
- if app code wants composition, it should compose handlers before registration

### Native knowledge ownership

- native-resolution knowledge for `wikilinkCompleted` moves into the package
- consumers must not need `app.metadataCache` or similar `App` access to decide whether Obsidian can already resolve a link
- the public payload may include derived facts like `canResolveNatively`, but not `App`-shaped access

### Wikilink click passthrough scope

- restored passthrough for `wikilinkClicked` is v1-scoped to plain unmodified left-click same-pane navigation only
- modifier-assisted navigation behavior remains native and is not abstracted into a broader public contract yet

### File context policy

- `sourcePath` is always a vault-relative string
- it is `undefined` only when there truly is no file context
- no public unions involving split-path domain types are allowed

### Result model policy

- the new result model is effect-only for mutating events
- read-only events return only `handled` or `passthrough`
- mutated payloads do not cross the public handler boundary

### Sequencing

- the factory/object facade should be introduced before the workspace move
- Phase 5 should be mostly file movement plus import rewiring, not a public contract redesign

### Internal validation policy

- Zod schemas may remain internal if they continue to help internal validation and tests
- Zod schemas are not part of the package public surface

### Public payload policy

Public payloads should be plain data only.

Rules:

- no `EditorView` on public payloads
- no `HTMLElement` on public payloads
- no `SplitPathToMdFile` in the public contract
- use vault-relative note path strings (`sourcePath`) instead
- keep effect data separate from input payload data

### Handler contract direction

The public handler contract should be effect-based rather than payload-mutation-based.

That means:

- handlers receive immutable input payloads
- handlers return `handled`, `passthrough`, or an event-specific effect
- the package applies the effect internally
- consumers do not call codec helpers or manipulate editor/view objects directly

## Proposed Tiny API

Working package name:

- `@textfresser/obsidian-event-layer`

Proposed public surface:

```ts
import type { App, Plugin } from "obsidian";

export type UserEventKind =
	| "clipboardCopy"
	| "checkboxClicked"
	| "checkboxFrontmatterClicked"
	| "actionElementClicked"
	| "selectAll"
	| "wikilinkCompleted"
	| "wikilinkClicked"
	| "selectionChanged";

export type UserEventPayloadMap = {
	clipboardCopy: {
		isCut: boolean;
		originalText: string;
		sourcePath?: string;
	};
	checkboxClicked: {
		checked: boolean;
		lineContent: string;
		sourcePath: string;
	};
	checkboxFrontmatterClicked: {
		checked: boolean;
		propertyName: string;
		sourcePath: string;
	};
	actionElementClicked: {
		actionId: string;
	};
	selectAll: {
		content: string;
		sourcePath?: string;
	};
	wikilinkCompleted: {
		linkContent: string;
		sourcePath?: string;
		canResolveNatively: boolean;
	};
	wikilinkClicked: {
		blockContent: string;
		sourcePath: string;
		target: {
			basename: string;
			alias?: string;
		};
	};
	selectionChanged: {
		hasSelection: boolean;
		selectedText: string;
		source: "mouse" | "keyboard" | "drag";
		sourcePath?: string;
	};
};

export type UserEventEffectMap = {
	clipboardCopy: { modifiedText: string };
	selectAll: { selection: { from: number; to: number } };
	wikilinkCompleted:
		| { aliasToInsert: string }
		| { resolvedTarget: string; aliasToInsert?: string };
};

export type UserEventResult<K extends UserEventKind> =
	| { outcome: "passthrough" }
	| { outcome: "handled" }
	| (K extends keyof UserEventEffectMap
			? { outcome: "effect"; effect: UserEventEffectMap[K] }
			: never);

export type UserEventHandler<K extends UserEventKind> = {
	doesApply: (payload: UserEventPayloadMap[K]) => boolean;
	handle: (
		payload: UserEventPayloadMap[K],
	) => UserEventResult<K> | Promise<UserEventResult<K>>;
};

export type SelectionTextSource = {
	getSelectionText(): string | null;
};

export type ObsidianEventLayerDeps = {
	app: App;
	plugin: Plugin;
	selectionTextSource: SelectionTextSource;
};

export type Teardown = () => void;

export interface ObsidianEventLayer {
	setHandler<K extends UserEventKind>(
		kind: K,
		handler: UserEventHandler<K>,
	): Teardown;
	start(): void;
	stop(): void;
}

export function createObsidianEventLayer(
	deps: ObsidianEventLayerDeps,
): ObsidianEventLayer;
```

## Why This API Is Small Enough

- one factory
- one registration method
- one lifecycle pair
- one event-kind enum/union
- typed payloads
- typed results

Everything else stays internal.

Notably absent from the public surface:

- `createEventCodec()`
- `ClipboardCodec`, `SelectAllCodec`, `WikilinkCodec`
- all detector classes
- `PayloadKind` Zod schema
- handler context carrying `App` or `VaultActionManager`

## Mapping From Current API

Current public shape leaks implementation detail in several ways:

- [`index.ts`](/Users/annagorelova/work/Textfresser_vault/.obsidian/plugins/textfresser/src/managers/obsidian/user-event-interceptor/index.ts) exports payload internals, handler types, and the class directly
- [`handler.ts`](/Users/annagorelova/work/Textfresser_vault/.obsidian/plugins/textfresser/src/managers/obsidian/user-event-interceptor/types/handler.ts) leaks `App` and `VaultActionManager` into every handler
- current payloads leak runtime objects like `EditorView` and `HTMLElement`
- current `Modified` flow mutates payload shape instead of returning a focused effect

Target mapping:

- `UserEventInterceptor` -> `createObsidianEventLayer()`
- `PayloadKind` -> `UserEventKind`
- `HandleResult.Modified + data` -> `outcome: "effect"`
- `splitPath` -> `sourcePath`
- `view` / `button` / editor refs -> internal package-only data

## Migration Plan

### Phase 1. Make the subsystem package-shaped in place

- keep the code in `src/managers/obsidian/user-event-interceptor/`
- stop importing package internals from outside the module
- update local consumers to import only from the top-level barrel
- treat detector/codecs as private even before the workspace move
- add boundary comments where needed: interception inside, business behavior outside

Exit condition:

- app code imports only the facade and public types

### Phase 2. Shrink the public contract

- replace `PayloadKind` public usage with a smaller `UserEventKind`
- remove public exports for detectors, codecs, payload schemas, and helper factories
- stop exposing `HandlerContext` with `App` and `VaultActionManager`
- convert result handling from payload-mutation to event-specific effects
- keep one handler per event kind
- keep `selectionChanged` public

Exit condition:

- the public surface is roughly the API proposed above

### Phase 3. Make payloads plain data

- replace public `splitPath` with `sourcePath: string`
- remove `EditorView` from public `SelectAllPayload` and `WikilinkPayload`
- remove `HTMLElement` from public `ActionElementPayload`
- move `wikilinkCompleted` native-resolution knowledge behind package internals
- move any event-application data needed for native handling behind internal adapters
- push Obsidian/editor-specific state back into detectors and codec/application internals

Exit condition:

- consumers handle plain event DTOs only

### Phase 4. Cut external coupling to narrow ports

- remove direct `VaultActionManager` dependency from the package public contract
- keep only the narrow external dependency needed for virtualized selection reads:
  - `selectionTextSource.getSelectionText()`
- internalize package-local helpers or re-home them under the package:
  - DOM selectors used only by interception
  - click-target helpers
  - editor extraction helpers
- keep app-specific business helpers outside the package

Exit condition:

- the package factory takes `app`, `plugin`, and narrow support ports only

### Phase 5. Move to `src/packages`

- create `src/packages/obsidian-event-layer/package.json`
- move the cleaned subsystem into `src/packages/obsidian-event-layer/src/`
- expose only the tiny facade from the package root
- update root `package.json` workspace consumption
- switch app imports to `@textfresser/obsidian-event-layer`

Exit condition:

- app code uses the workspace package and does not import the old in-tree path

### Phase 6. Re-test by ownership

- package tests cover:
  - detector applicability
  - payload normalization
  - effect application
  - lifecycle start/stop
  - handler result routing
- app tests cover:
  - behavior decisions
  - commander delegation
  - integration wiring in `main.ts` and `OverlayManager`

Exit condition:

- package tests do not need Textfresser/Librarian business logic
- app tests do not need detector internals

## Highest-Risk Cuts

The highest-risk steps are:

1. Clipboard interception
   - current behavior depends on virtualized selection access and browser clipboard timing
2. Wikilink completion
   - current behavior mixes detection, native resolution knowledge, and editor mutation timing
3. Wikilink click passthrough restoration
   - current implementation intercepts first, then may need to restore Obsidian navigation

These paths should get focused regression coverage before the package move.

## Non-Goals

This plan does not try to:

- merge user events with workspace-navigation events
- make the package usable outside Obsidian
- create a generalized event bus for all plugin concerns
- export every current payload/schema/helper just because it exists today

## Success Criteria

The migration is done when:

- `textfresser` imports user-event infrastructure only from `@textfresser/obsidian-event-layer`
- handlers receive plain payloads and return focused effects
- no handler depends on `App` or `VaultActionManager`
- no external code imports detectors/codecs/helpers
- the package owns Obsidian/editor application details internally
- tests are split cleanly between package-owned event mechanics and app-owned behavior logic

## Practical Recommendation

Do not start with the file move.

Start with Phase 1 and Phase 2 while the code remains in place. If the proposed API still feels natural after those cuts, the workspace extraction is justified. If the API still wants to leak editor objects, split-path types, or `App` access, the boundary is not ready yet.
