import type { ParsingIssue } from "common-utils/validation";

/** Where in a note's metadata an issue sits: a field, and an index into a list field. */
export type IssueLocation = {
	readonly field: string;
	readonly index?: number;
};

export type RecordName =
	| "LemmaRecord"
	| "ReadingEntry"
	| "SurfaceEntry"
	| "PendingSemanticRelationRecord";

/**
 * Why a note's metadata does not make valid dumdict records. Issues are
 * values: parsing a hand-edited note never throws.
 */
export type CodecIssue =
	| {
			/** The note has no data of its kind in its metadata. */
			readonly _tag: "MissingMetadata";
			readonly message: string;
	  }
	| {
			/** The note's metadata is not the shape its kind's schema gives. */
			readonly _tag: "InvalidMetadata";
			readonly message: string;
	  }
	| {
			/**
			 * The note is in the retired marker format (`%%tf-part…%%`,
			 * `%%tf:<kind>…%%`): the Dictionary reset regenerates it.
			 */
			readonly _tag: "LegacyMarkerFormat";
			readonly message: string;
	  }
	| {
			/** A reconstructed record its dumdict `parseAs*` parser rejects. */
			readonly _tag: "InvalidRecord";
			readonly record: RecordName;
			readonly at: IssueLocation;
			readonly issues: readonly ParsingIssue[];
			readonly message: string;
	  }
	| {
			/** Valid records that contradict each other or the note (spec invariants). */
			readonly _tag: "InconsistentRecord";
			readonly at: IssueLocation;
			readonly message: string;
	  };

export type CodecIssueTag = CodecIssue["_tag"];

/** A line the retired marker format opened a part or a Block with. */
const LEGACY_MARKER = /^%%tf(?:-part)?:[A-Za-z0-9_-]+/mu;

/** Whether a body holds a line of the retired marker format. */
const holdsLegacyMarkers = (body: string): boolean => LEGACY_MARKER.test(body);

/** The issues of a note whose metadata holds no data of its kind. */
export function missingMetadata(
	body: string,
	kind: "Lemma" | "Reading",
): readonly [CodecIssue, ...CodecIssue[]] {
	const missing: CodecIssue = {
		_tag: "MissingMetadata",
		message: `The note's metadata holds no ${kind} note data`,
	};
	return holdsLegacyMarkers(body)
		? [
				{
					_tag: "LegacyMarkerFormat",
					message:
						"The note is in the retired %%tf marker format; the Dictionary reset regenerates it",
				},
				missing,
			]
		: [missing];
}
