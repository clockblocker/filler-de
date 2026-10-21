import { germanSlotsOf, type Slot } from "./slot-table-de";

/**
 * The slot grammar of a Lemma's identity folders (ADR-0013, kept by
 * ADR-0015): each Core Feature of a route has a fixed position. A null in
 * the middle is `_`, trailing nulls are dropped, a feature a Syncretism
 * leaves open is `~`, and a value set joins its members with `+`. Only text
 * slots, such as `hasSepPrefix`, differ between layouts, so each layout
 * passes its own {@link TextSlotCodec}.
 */
export const NULL_SLOT = "_";
const SYNCRETIC_SLOT = "~";
const SET_SEPARATOR = "+";
const FLAG_VALUE = "Yes";

/** How a layout writes an open text value into a slot folder and back. */
export type TextSlotCodec = {
	/** Never returns `_` or `~`, so a text value can't read as a symbol. */
	readonly encode: (value: string) => string;
	/** Undefined for a folder `encode` never writes. */
	readonly decode: (folder: string) => string | undefined;
};

export function slotsOrThrow(family: string, kind: string): readonly Slot[] {
	const slots = germanSlotsOf(family, kind);
	if (slots === undefined)
		throw new Error(`No path slots for the German route ${family}/${kind}`);
	return slots;
}

/** A route's slot folders, with trailing null slots dropped. */
export function spellSlots(
	slots: readonly Slot[],
	core: Readonly<Record<string, unknown>>,
	text: TextSlotCodec,
	syncretic: readonly string[] = [],
): string[] {
	const open = new Set(syncretic);
	const spelled = slots.map((slot) =>
		open.has(slot.feature)
			? SYNCRETIC_SLOT
			: encodeSlot(slot, core[slot.feature], text),
	);
	while (spelled.at(-1) === NULL_SLOT) spelled.pop();
	return spelled;
}

function encodeSlot(slot: Slot, value: unknown, text: TextSlotCodec): string {
	if (value === null || value === undefined) return NULL_SLOT;
	switch (slot.encoding) {
		case "flag":
			if (value === FLAG_VALUE) return slot.feature;
			break;
		case "value":
			if (typeof value === "string" && isClosedValue(value)) return value;
			break;
		case "text":
			if (typeof value === "string" && value.length > 0)
				return text.encode(value);
			break;
		case "valueSet":
			if (typeof value === "string" && isClosedValue(value)) return value;
			if (
				typeof value === "object" &&
				"mixed" in value &&
				Array.isArray(value.mixed) &&
				value.mixed.every(
					(member) =>
						typeof member === "string" && isClosedValue(member),
				)
			)
				return value.mixed.join(SET_SEPARATOR);
			break;
	}
	throw new Error(
		`Core Feature ${slot.feature} has a value its path slot cannot spell: ${JSON.stringify(value)}`,
	);
}

/** What a route's slot folders spell. */
export type ParsedSlots = {
	/** Every slot's feature, null where the path holds `_`, `~` or nothing. */
	readonly coreFeatures: Readonly<Record<string, unknown>>;
	/** The features spelled `~`, in alphabetical order, if any. */
	readonly syncretic?: readonly string[];
};

/**
 * Reverses {@link spellSlots}, or gives the reason the folders are not the
 * canonical spelling of any Core Features: too many slots, a trailing `_`,
 * or a value the slot's feature never takes.
 */
export function parseSlots(
	slots: readonly Slot[],
	spelled: readonly string[],
	text: TextSlotCodec,
): ParsedSlots | string {
	if (spelled.length > slots.length)
		return `The route has ${slots.length} slots`;
	if (spelled.at(-1) === NULL_SLOT)
		return "A trailing null slot is dropped, not written";
	const coreFeatures: Record<string, unknown> = {};
	const syncretic: string[] = [];
	for (const [index, slot] of slots.entries()) {
		const folder = spelled[index];
		if (folder === undefined || folder === NULL_SLOT) {
			coreFeatures[slot.feature] = null;
			continue;
		}
		if (folder === SYNCRETIC_SLOT) {
			coreFeatures[slot.feature] = null;
			syncretic.push(slot.feature);
			continue;
		}
		const value = decodeSlot(slot, folder, text);
		if (value === undefined)
			return `Slot ${index + 1} cannot spell ${slot.feature}`;
		coreFeatures[slot.feature] = value;
	}
	if (!sameSpelling(slots, coreFeatures, syncretic, spelled, text))
		return "Not the canonical spelling of its Core Features";
	return {
		coreFeatures,
		...(syncretic.length > 0 ? { syncretic: syncretic.toSorted() } : {}),
	};
}

/** Whether the parsed features spell exactly the folders they came from. */
function sameSpelling(
	slots: readonly Slot[],
	core: Readonly<Record<string, unknown>>,
	syncretic: readonly string[],
	spelled: readonly string[],
	text: TextSlotCodec,
): boolean {
	try {
		const canonical = spellSlots(slots, core, text, syncretic);
		return (
			canonical.length === spelled.length &&
			canonical.every((folder, index) => folder === spelled[index])
		);
	} catch {
		return false;
	}
}

function decodeSlot(slot: Slot, folder: string, text: TextSlotCodec): unknown {
	switch (slot.encoding) {
		case "flag":
			return folder === slot.feature ? FLAG_VALUE : undefined;
		case "value":
			return isClosedValue(folder) ? folder : undefined;
		case "text":
			return text.decode(folder);
		case "valueSet": {
			const members = folder.split(SET_SEPARATOR);
			if (!members.every(isClosedValue)) return undefined;
			// A value set is distinct and in catalog (code-point) order.
			const ascending = members.every(
				(member, index) =>
					index === 0 || (members[index - 1] ?? "") < member,
			);
			if (!ascending) return undefined;
			return members.length === 1 ? folder : { mixed: members };
		}
	}
}

/** A closed value never collides with the slot syntax or needs escaping. */
function isClosedValue(text: string): boolean {
	return /^[A-Za-z0-9]+$/u.test(text);
}
