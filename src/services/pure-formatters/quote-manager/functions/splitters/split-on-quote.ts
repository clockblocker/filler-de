/**
 * Split at: <non-space><quotation_mark><spaces><Capital|Titlecase|OpeningQuote>
 * e.g. …!" Sie …   or   …" Darauf …   or   …» «Als …
 *
 * Keeps the closing quote on the left chunk and removes the separating spaces.
 */
export function splitOnQuote(text: string): string[] {
  // Split on the whitespace after a closing quote
  const QUOTE_WS_EOS =
    /(?<=\S\p{Quotation_Mark})\s+(?=(\p{Lu}|\p{Lt}|\p{Pi}|\p{Ps}))/gu;

  const parts: string[] = [];
  let last = 0;

  for (const m of text.matchAll(QUOTE_WS_EOS)) {
    const start = m.index!; // start of the whitespace
    const end = start + m[0].length; // end of the whitespace
    const left = text.slice(last, start).trimEnd();
    if (left) parts.push(left);
    last = end; // skip the whitespace
  }

  const tail = text.slice(last);
  if (tail.trim().length) parts.push(tail);

  return parts;
}
