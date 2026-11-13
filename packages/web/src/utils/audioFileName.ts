const pad = (n: number, length = 2) => String(n).padStart(length, '0');

/** Local time as yyyyMMdd-HHmmss (24-hour clock, zero-padded). */
export const formatLocalTimestamp = (date: Date): string =>
  `${pad(date.getFullYear(), 4)}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
  `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

const NAME_PATTERN = /^(.*-\d{8}-\d{6})(?:-(\d+))?(\.[A-Za-z0-9]+)$/;

/**
 * Never returns the same name twice in a row: when the name equals the last
 * used one (same second, voice and format), -2, -3, ... is added before the
 * extension.
 */
export const makeUniqueFileName = (
  fileName: string,
  lastName: string | null
): string => {
  if (!lastName) return fileName;
  const next = NAME_PATTERN.exec(fileName);
  const last = NAME_PATTERN.exec(lastName);
  if (!next || !last || next[1] !== last[1] || next[3] !== last[3]) {
    return fileName;
  }
  // fileName comes from the server and has no suffix
  const count = Number(last[2] ?? 1) + 1;
  return `${next[1]}-${count}${next[3]}`;
};
