/**
 * A small reader for the old-format notes under `Worter/` (#65). It keeps
 * only what the reset carries over, attestation embeds and freeform text,
 * plus what finds an attestation's Segment again: the note's headword and
 * the forms it listed. It depends on no old package.
 *
 * An old note is a run of entries. Each entry opens with a header line that
 * ends in an entry ID (`^LX-LM-NOUN-1`, `^LX-IN-VERB-1`, `^MO-LM-1`) and
 * goes on in sections, each under a
 * `<span class="entry_section_title …">…</span>` title. A JSON metadata
 * section, `<section id="textfresser_meta_keep_me_invisible">`, ends the
 * note. Its entries come in two shapes: `lexicalMeta` (`metaTag`,
 * `emojiDescription`, sometimes `verbEntryIdentity`) and `entity` (the
 * whole linguistic entity, with its `linguisticUnit`). Most notes have no
 * metadata at all: propagation stubs that hold only a relations section,
 * inflection hosts (`#Inflection/Noun/… for: [[Lemma]]`), empty notes and
 * scratch notes.
 *
 * Freeform text is every line that is not part of that structure: lines
 * before the first entry, lines after a section once two or more blank
 * lines have ended it, and non-embed lines in a Kontexte section.
 */
import { CrossroadNoteMetadata } from "@textfresser/dictionary";
import { Option, Schema } from "effect";
import {
	type AnyMetadataNamespace,
	LemmaNoteMetadata,
	noteMetadataHelper,
	ReadingNoteMetadata,
} from "../../stateless-helpers/note-metadata";

/** The metadata shape of one old entry. */
export type OldMetaShape = "LexicalMeta" | "Entity" | "Unrecognized";

/** What an old note is, by its structure. */
export type OldNoteKind =
	/** At least one entry header that is not an inflection host. */
	| "Entry"
	/** Only `#Inflection/… for: [[Lemma]]` headers. */
	| "InflectionHost"
	/** Sections without any entry header: a propagation stub. */
	| "Stub"
	/** Nothing but freeform text. */
	| "FreeformOnly"
	/** Nothing but whitespace. */
	| "Empty"
	/**
	 * A note a newer build wrote, not an old note: one in the marker format
	 * (`%%tf-part:` or `%%tf:`), such as a Shadow note from before #109, or
	 * one whose metadata holds dictionary data (#112). The reset reads
	 * nothing from it, and Execute refuses to run while `Worter/` holds one.
	 */
	| "NewFormat";

/** An attestation embed: `![[Scroll#^id|^]]`. */
export type OldAttestation = {
	/** The embed exactly as the note holds it. */
	readonly embed: string;
	/** The embed's link path: the Scroll's basename or path. */
	readonly linkpath: string;
	readonly blockId: string;
	/** Its 1-based line in the note. */
	readonly line: number;
};

/** One contiguous run of freeform lines, trimmed of blank edge lines. */
export type OldFreeformBlock = {
	readonly text: string;
	/** Its first line in the note, 1-based. */
	readonly line: number;
};

export type OldNote = {
	readonly path: string;
	readonly basename: string;
	/** The Lemma the note was about: its header link, else its metadata, else its basename. */
	readonly headword: string;
	readonly kind: OldNoteKind;
	/** One per metadata entry, in the note's order. */
	readonly metaShapes: readonly OldMetaShape[];
	/** Entry IDs from the headers. */
	readonly entryIds: readonly string[];
	/**
	 * Spellings an attestation's Segment may have, most likely first: the
	 * headword, the basename, and the forms its inflection section linked.
	 */
	readonly forms: readonly string[];
	readonly attestations: readonly OldAttestation[];
	readonly freeform: readonly OldFreeformBlock[];
	/** Whether the note opened with YAML frontmatter, which is not carried over. */
	readonly frontmatter: boolean;
	/** Whether a metadata section was there but could not be read. */
	readonly unreadableMeta: boolean;
};

const ENTRY_HEADER = /(?:^|\s)\^([A-Z]{2}(?:-[A-Z0-9]+)*-\d+)\s*$/u;
const SECTION_TITLE =
	/^\s*<span class="entry_section_title(?: entry_section_title_([A-Za-z0-9_-]+))?">[^<]*<\/span>\s*$/u;
const META_OPEN = /^\s*<section id="textfresser_meta_keep_me_invisible">\s*$/u;
const META_CLOSE = /^\s*<\/section>\s*$/u;
const SEPARATOR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u;
const INFLECTION_HOST = /^\s*#Inflection\//u;
/** A block embed; group 1 is its link path, group 2 its block ID. */
const BLOCK_EMBED = /!\[\[([^\]|#\n]+)#\^([A-Za-z0-9-]+)(?:\|[^\]\n]*)?\]\]/gu;
const WIKILINK = /(?<!!)\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/gu;
const isBlank = (line: string) => line.trim() === "";

const EmojiDescription = Schema.optionalKey(Schema.Array(Schema.String));

const LexicalMetaEntry = Schema.Struct({
	lexicalMeta: Schema.Struct({
		emojiDescription: EmojiDescription,
		metaTag: Schema.String,
	}),
});

const EntityEntry = Schema.Struct({
	entity: Schema.Struct({
		emojiDescription: EmojiDescription,
		lemma: Schema.String,
	}),
});

const OldMeta = Schema.fromJsonString(
	Schema.Struct({
		entries: Schema.Record(Schema.String, Schema.Unknown),
	}),
);

const decodeMeta = Schema.decodeUnknownOption(OldMeta);
const decodeLexicalMeta = Schema.decodeUnknownOption(LexicalMetaEntry);
const decodeEntity = Schema.decodeUnknownOption(EntityEntry);

type MetaRead = {
	readonly shapes: OldMetaShape[];
	readonly lemmas: string[];
	readonly readable: boolean;
};

function readMeta(json: string): MetaRead {
	const meta = decodeMeta(json);
	if (Option.isNone(meta)) return { lemmas: [], readable: false, shapes: [] };
	const shapes: OldMetaShape[] = [];
	const lemmas: string[] = [];
	for (const entry of Object.values(meta.value.entries)) {
		const entity = decodeEntity(entry);
		if (Option.isSome(entity)) {
			shapes.push("Entity");
			lemmas.push(entity.value.entity.lemma);
			continue;
		}
		shapes.push(
			Option.isSome(decodeLexicalMeta(entry))
				? "LexicalMeta"
				: "Unrecognized",
		);
	}
	return { lemmas, readable: true, shapes };
}

function basenameOf(path: string): string {
	const file = path.split("/").at(-1) ?? path;
	return file.endsWith(".md") ? file.slice(0, -3) : file;
}

/** The last segment of a link path: `Worter/de/…/Fahrer` is `Fahrer`. */
export const linkBasename = (target: string): string =>
	target.split("/").at(-1)?.trim() ?? target.trim();

function linkTargets(line: string): string[] {
	return [...line.matchAll(WIKILINK)].flatMap(([, target]) =>
		target === undefined ? [] : [linkBasename(target)],
	);
}

/**
 * The headword a header line names: its first wikilink, else, as `k
 * ^MO-LM-1` has it, its one remaining word once Markdown links and emojis
 * are gone.
 */
function headerHeadword(line: string): {
	readonly headword: string | undefined;
	readonly linked: boolean;
} {
	const [linked] = linkTargets(line);
	if (linked) return { headword: linked, linked: true };
	const words = line
		.replace(ENTRY_HEADER, "")
		.replace(/\[[^\]\n]*\]\([^)\n]*\)/gu, " ")
		.replace(/[,;]/gu, " ")
		.split(/\s+/u)
		.filter((word) => /[\p{L}\p{N}]/u.test(word));
	return {
		headword: words.length === 1 ? words[0] : undefined,
		linked: false,
	};
}

/** The pseudo section kind of the lines right under an entry's header. */
const HEADER = "header";

/** A line of only links, `|` or `+` and `=` between them, and `*(glosses)*`. */
const LINKS_LINE =
	/^\s*(?:\[\[[^\]\n]*\]\][\s|+=,]*)+(?:\*\([^)\n]*\)\*)?\s*$/u;

/**
 * Whether a line is what the old generator wrote into a section of this
 * kind. Anything else is the user's, and so freeform. Under an entry's
 * header and in a section of unknown kind no line is generated.
 */
function isGenerated(
	kind: string | undefined,
	line: string,
	/** Generated lines the section already had. */
	before: number,
): boolean {
	const text = line.trim();
	switch (kind) {
		case "kontexte":
			return text.replace(BLOCK_EMBED, "").trim() === "";
		case "synonyme":
			// `= [[A]], [[B]]`, `⊃ [[C]]`: a relation sign and links.
			return /^\S{1,2}\s+(?:\[\[[^\]\n]*\]\][\s,]*)+$/u.test(text);
		case "translations":
			return before === 0;
		case "morpheme":
			return LINKS_LINE.test(text);
		case "morphologie":
			return /^[\p{L} ]{3,40}:$/u.test(text) || LINKS_LINE.test(text);
		case "tags":
			return /^(?:#[^\s#]+\s*)+$/u.test(text);
		case "flexion":
			// `N: der [[Fahrer]], die [[Fahrer]]`, `Präsens: [[passe]]`
			return /^[^:\n]{1,40}:\s.*\[\[/u.test(text);
		default:
			return false;
	}
}

function frontmatterEnd(lines: readonly string[]): number {
	if (lines[0]?.trim() !== "---") return 0;
	for (let index = 1; index < lines.length; index++)
		if (lines[index]?.trim() === "---") return index + 1;
	return 0;
}

type State =
	/** Before any entry or section: lines are freeform. */
	| "outside"
	/** In an entry's header or a section: lines are its body. */
	| "section"
	/** After a section ended in two or more blank lines: lines are freeform. */
	| "after"
	| "meta";

/** Whether a note's metadata, in either format, holds dictionary data. */
function holdsDictionaryData(content: string): boolean {
	const namespaces: readonly AnyMetadataNamespace[] = [
		LemmaNoteMetadata,
		ReadingNoteMetadata,
		CrossroadNoteMetadata,
	];
	return namespaces.some(
		(namespace) =>
			noteMetadataHelper.inspect(content, namespace, "Hidden").kind !==
			"Absent",
	);
}

/** Reads one old note. It never fails; what it cannot place is freeform. */
export function readOldNote(path: string, content: string): OldNote {
	const lines = content.replace(/\r\n?/gu, "\n").split("\n");
	const basename = basenameOf(path);
	if (
		lines.some((line) => /^%%tf(?:-part)?:/u.test(line)) ||
		holdsDictionaryData(content)
	)
		return {
			attestations: [],
			basename,
			entryIds: [],
			forms: [basename],
			freeform: [],
			frontmatter: false,
			headword: basename,
			kind: "NewFormat",
			metaShapes: [],
			path,
			unreadableMeta: false,
		};
	const attestations: OldAttestation[] = [];
	const freeform: OldFreeformBlock[] = [];
	const entryIds: string[] = [];
	const headers: {
		readonly headword?: string;
		readonly host: boolean;
		readonly linked: boolean;
	}[] = [];
	const inflectedForms: string[] = [];
	let sections = 0;
	let meta: MetaRead | undefined;
	let metaLines: string[] = [];
	let sawMeta = false;
	/** The 0-based line of the metadata section's opening tag. */
	let metaStart = 0;
	/** Generated lines read so far in the current section. */
	let sectionLines = 0;

	let open: { start: number; lines: string[] } | undefined;
	const closeFreeform = () => {
		if (!open) return;
		const kept = [...open.lines];
		let start = open.start;
		while (kept.length > 0 && isBlank(kept[0] ?? "")) {
			kept.shift();
			start++;
		}
		while (kept.length > 0 && isBlank(kept.at(-1) ?? "")) kept.pop();
		if (kept.length > 0)
			freeform.push({ line: start, text: kept.join("\n") });
		open = undefined;
	};
	const addFreeform = (line: string, number: number) => {
		if (!open) {
			if (isBlank(line)) return;
			open = { lines: [], start: number };
		}
		open.lines.push(line);
	};

	const skipped = frontmatterEnd(lines);
	let state: State = "outside";
	let sectionKind: string | undefined;
	let blankRun = 0;
	for (let index = skipped; index < lines.length; index++) {
		const line = lines[index] ?? "";
		const number = index + 1;

		if (state === "meta") {
			if (META_CLOSE.test(line)) {
				meta = readMeta(metaLines.join("\n"));
				metaLines = [];
				state = "after";
				blankRun = 2;
			} else metaLines.push(line);
			continue;
		}
		for (const match of line.matchAll(BLOCK_EMBED)) {
			const [embed, linkpath, blockId] = match;
			if (linkpath && blockId)
				attestations.push({
					blockId,
					embed,
					line: number,
					linkpath: linkpath.trim(),
				});
		}
		if (META_OPEN.test(line)) {
			closeFreeform();
			sawMeta = true;
			metaStart = index;
			state = "meta";
			continue;
		}
		const header = ENTRY_HEADER.exec(line);
		if (header?.[1]) {
			closeFreeform();
			entryIds.push(header[1]);
			const host = INFLECTION_HOST.test(line);
			const { headword, linked } = headerHeadword(line);
			headers.push({ host, linked, ...(headword ? { headword } : {}) });
			state = "section";
			sectionKind = HEADER;
			sectionLines = 0;
			blankRun = 0;
			continue;
		}
		const title = SECTION_TITLE.exec(line);
		if (title) {
			closeFreeform();
			sections++;
			state = "section";
			sectionKind = title[1]?.replace(/^entry_section_title_/u, "");
			sectionLines = 0;
			blankRun = 0;
			continue;
		}
		if (SEPARATOR.test(line) && state !== "outside") {
			const next = lines
				.slice(index + 1)
				.find((candidate) => !isBlank(candidate));
			if (next !== undefined && ENTRY_HEADER.test(next)) {
				closeFreeform();
				continue;
			}
		}

		if (state === "section") {
			if (isBlank(line)) {
				blankRun++;
				if (open) addFreeform(line, number);
				if (blankRun >= 2) state = "after";
				continue;
			}
			blankRun = 0;
			if (!isGenerated(sectionKind, line, sectionLines)) {
				addFreeform(line, number);
				continue;
			}
			closeFreeform();
			sectionLines++;
			if (sectionKind === "flexion")
				inflectedForms.push(...linkTargets(line));
			continue;
		}
		addFreeform(line, number);
	}
	if (state === "meta") {
		// A metadata section that never closes: its JSON line is metadata,
		// anything else in it is the user's.
		meta = readMeta(metaLines.find((line) => line.trim() !== "") ?? "");
		let jsonSeen = false;
		for (const [offset, line] of metaLines.entries()) {
			if (!jsonSeen && line.trim() !== "") {
				jsonSeen = true;
				continue;
			}
			addFreeform(line, metaStart + offset + 2);
		}
	}
	closeFreeform();

	// A linked entry header names the Lemma best, then the metadata, then
	// a header's lone word, then an inflection host's Lemma.
	const entries = headers.filter(({ host }) => !host);
	const headword =
		entries.find(({ linked }) => linked)?.headword ??
		meta?.lemmas[0] ??
		entries.find(({ headword }) => headword)?.headword ??
		headers.find(({ host }) => host)?.headword ??
		basename;
	const kind: OldNoteKind =
		headers.length > 0
			? headers.every(({ host }) => host)
				? "InflectionHost"
				: "Entry"
			: sections > 0
				? "Stub"
				: freeform.length > 0 || attestations.length > 0
					? "FreeformOnly"
					: "Empty";
	return {
		attestations,
		basename,
		entryIds,
		forms: [
			...new Set(
				[headword, basename, ...(meta?.lemmas ?? []), ...inflectedForms]
					.map((form) => form.trim())
					.filter(Boolean),
			),
		],
		freeform,
		frontmatter: skipped > 0,
		headword,
		kind,
		metaShapes: meta?.shapes ?? [],
		path,
		unreadableMeta: sawMeta && meta?.readable !== true,
	};
}
