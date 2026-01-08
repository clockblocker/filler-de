import {
	type VaultEvent,
	VaultEventType,
} from "../../../../../../types/vault-event";
import { makeKeyFor } from "../../../../../common/collapse-helpers";

export function makeKeyForEvent(e: VaultEvent): string {
	switch (e.type) {
		case VaultEventType.FileCreated:
		case VaultEventType.FolderCreated:
			return `${e.type}:${makeKeyFor(e)}`;

		case VaultEventType.FileDeleted:
		case VaultEventType.FolderDeleted:
			return `${e.type}:${makeKeyFor(e)}`;

		case VaultEventType.FileRenamed:
		case VaultEventType.FolderRenamed:
			return `${e.type}:${makeKeyFor(e.from)}→${makeKeyFor(e.to)}`;
	}
}
