import {
	type VaultEvent,
	VaultEventKind,
} from "../../../../../../types/vault-event";
import { makeKeyFor } from "../../../../../common/collapse-helpers";

export function makeKeyForEvent(e: VaultEvent): string {
	switch (e.kind) {
		case VaultEventKind.FileCreated:
		case VaultEventKind.FolderCreated:
			return `${e.kind}:${makeKeyFor(e)}`;

		case VaultEventKind.FileDeleted:
		case VaultEventKind.FolderDeleted:
			return `${e.type}:${makeKeyFor(e)}`;

		case VaultEventKind.FileRenamed:
		case VaultEventKind.FolderRenamed:
			return `${e.type}:${makeKeyFor(e.from)}→${makeKeyFor(e.to)}`;
	}
}
