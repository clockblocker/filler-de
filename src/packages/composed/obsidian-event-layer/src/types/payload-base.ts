import { z } from "zod";
import { UserEventKind, type UserEventPayloadMap } from "../contracts";

export const PayloadKindSchema = z.enum([
	UserEventKind.CheckboxClicked,
	UserEventKind.CheckboxFrontmatterClicked,
	UserEventKind.ActionElementClicked,
	UserEventKind.ClipboardCopy,
	UserEventKind.SelectAll,
	UserEventKind.WikilinkCompleted,
	UserEventKind.WikilinkClicked,
	UserEventKind.SelectionChanged,
]);

export type PayloadKind = z.infer<typeof PayloadKindSchema>;

export const PayloadKind = {
	ActionElementClicked: UserEventKind.ActionElementClicked,
	CheckboxClicked: UserEventKind.CheckboxClicked,
	CheckboxInFrontmatterClicked: UserEventKind.CheckboxFrontmatterClicked,
	ClipboardCopy: UserEventKind.ClipboardCopy,
	SelectAll: UserEventKind.SelectAll,
	SelectionChanged: UserEventKind.SelectionChanged,
	WikilinkClicked: UserEventKind.WikilinkClicked,
	WikilinkCompleted: UserEventKind.WikilinkCompleted,
} as const;

export type AnyPayload = UserEventPayloadMap[PayloadKind];
