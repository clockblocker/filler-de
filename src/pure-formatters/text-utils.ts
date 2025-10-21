export const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const reEscapeCharClass = (s: string) => s.replace(/[-\\\]^]/g, "\\$&");
