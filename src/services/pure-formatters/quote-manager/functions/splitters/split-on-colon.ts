/**
 * Split text on colon-based sentence boundaries.
 * @param keepColon - if true, keep ":" at end of the left chunk.
 */
export function splitOnDoubleColon(text: string, keepColon = true): string[] {
  // Colon-as-EOS: not part of a number/time, not a URL scheme, and followed by quote/Upper/Dash
  const COLON_EOS =
    /(?<!\p{Nd})(:)\s+(?!\/\/)(?=(\p{Quotation_Mark}|[\p{Lu}\p{Lt}]|[\p{Dash_Punctuation}—–-]))/gu;

  const parts: string[] = [];
  let last = 0;

  for (const m of text.matchAll(COLON_EOS)) {
    const matchStart = m.index!;
    const matchLen = m[0].length; // ":" + spaces
    const colonPos = matchStart + 1; // position of ":"

    const leftEnd = keepColon ? colonPos : matchStart;
    const rightStart = matchStart + matchLen; // skip the consumed spaces

    const left = text.slice(last, leftEnd).trimEnd();
    if (left) parts.push(left);

    last = rightStart;
  }

  const tail = text.slice(last);
  if (tail.trim().length) parts.push(tail);

  return parts;
}
