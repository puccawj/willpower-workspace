export interface ParsedRange {
  start: Date;
  end: Date;
}

/** Parses loose "Jun 3 – Aug 19" style ranges used in the mock offering data. */
export function parseDateRange(text: string, year = 2026): ParsedRange | null {
  const parts = text.split(/[–—-]/).map((s) => s.trim());
  if (parts.length !== 2) return null;
  const start = new Date(`${parts[0]}, ${year}`);
  const end = new Date(`${parts[1]}, ${year}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

export function rangesOverlap(a: ParsedRange, b: ParsedRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}
