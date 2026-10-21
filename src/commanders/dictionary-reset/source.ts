/**
 * Where the reset reads its old notes from (#117). The first reset, on
 * 2026-10-21, moved the old notes into `Worter backup 2026-10-21 05-43-21/`
 * and left obsolete marker-format notes in `Worter/`. So the source is a
 * choice the user sees: `Worter/` itself, or a `Worter backup …` folder at
 * the vault's root. The suggestion is `Worter/` when it holds old notes,
 * else the newest backup that does. Execute always names its source.
 */
import { Effect } from "effect";
import type { OldNote } from "./old-notes";
import { collectOldNotes, WORTER } from "./plan";
import { ResetFailed, type ResetVault } from "./ports";

/** `Worter backup 2026-10-21 05-43-21`, or `… 2` when that name was taken. */
const BACKUP_FOLDER =
	/^Worter backup (\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2})(?: (\d+))?$/u;

/** Whether a folder is one the reset may read old notes from. */
const isSourceFolder = (folder: string): boolean =>
	folder === WORTER || BACKUP_FOLDER.test(folder);

/** Whether the reset regenerates from a note: neither obsolete nor new. */
export const isOldNote = ({ kind }: Pick<OldNote, "kind">): boolean =>
	kind !== "Obsolete" && kind !== "NewFormat";

type SourceCandidate = {
	readonly folder: string;
	/** Notes the reset would regenerate from. */
	readonly oldNotes: number;
	/** Every Markdown note in it. */
	readonly notes: number;
};

export type SourceChoice = {
	/** `Worter/` first, then the backups, newest first. */
	readonly candidates: readonly SourceCandidate[];
	/** The folder the modal and the dry run start from, if any holds old notes. */
	readonly suggested: string | undefined;
};

/** Newest first: by stamp, then by the `2`, `3` a taken name got. */
function newestFirst(a: string, b: string): number {
	const [, stampA = "", suffixA = "1"] = BACKUP_FOLDER.exec(a) ?? [];
	const [, stampB = "", suffixB = "1"] = BACKUP_FOLDER.exec(b) ?? [];
	if (stampA !== stampB) return stampA < stampB ? 1 : -1;
	return Number(suffixB) - Number(suffixA);
}

/** Lists `Worter/` and every backup folder, with how many old notes each holds. */
export const findSources = Effect.fnUntraced(function* (
	vault: ResetVault,
): Effect.fn.Return<SourceChoice, ResetFailed> {
	const roots = yield* vault.listRootFolders;
	const folders = [
		...(roots.includes(WORTER) ? [WORTER] : []),
		...roots
			.filter((folder) => BACKUP_FOLDER.test(folder))
			.sort(newestFirst),
	];
	const candidates: SourceCandidate[] = [];
	for (const folder of folders) {
		const listed = yield* vault.listFolder(folder);
		if (!listed) continue;
		const { notes } = collectOldNotes(listed.markdown);
		candidates.push({
			folder,
			notes: notes.length,
			oldNotes: notes.filter(isOldNote).length,
		});
	}
	return {
		candidates,
		suggested: candidates.find(({ oldNotes }) => oldNotes > 0)?.folder,
	};
});

/** The source to use: the one asked for, else the suggestion. */
export const chooseSource = Effect.fnUntraced(function* (
	vault: ResetVault,
	requested: string | undefined,
): Effect.fn.Return<string, ResetFailed> {
	if (requested !== undefined) {
		const folder = requested.replace(/\/+$/u, "");
		if (!isSourceFolder(folder))
			return yield* new ResetFailed({
				cause: folder,
				message: `${folder}/ is neither ${WORTER}/ nor a "${WORTER} backup <date time>" folder at the vault's root`,
			});
		return folder;
	}
	const { suggested } = yield* findSources(vault);
	if (suggested === undefined)
		return yield* new ResetFailed({
			cause: WORTER,
			message: `Neither ${WORTER}/ nor any "${WORTER} backup <date time>" folder holds old notes; there is nothing to reset`,
		});
	return suggested;
});
