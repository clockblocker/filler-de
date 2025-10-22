import type { Optional } from "../../types/helpers";

type FullQuote = {
	fileName: string;
	text: string;
	linkId: number;
};

export type BacklinkToQuote = Optional<FullQuote, "text">;

export type LinkedQuote = Optional<FullQuote, "fileName">;
