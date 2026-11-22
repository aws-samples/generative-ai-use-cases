export type ReleaseNote = {
  /** Heading of the release, for example "v5.5.0 (2026-07-19)". */
  title: string;
  /** Versions named in the heading, for example ["5.1.0", "5.1.2"]. */
  versions: string[];
  /** The first subsection of the release (its highlights), as Markdown. */
  highlights: string;
};

const VERSION_PATTERN = /v(\d+\.\d+\.\d+)/g;

/**
 * Compares two versions such as "5.6.0". Returns a negative number, 0 or a
 * positive number. A missing or malformed part counts as 0.
 */
export const compareVersions = (a: string, b: string): number => {
  const pa = a.replace(/^v/, '').split('.');
  const pb = b.replace(/^v/, '').split('.');
  for (let i = 0; i < 3; i++) {
    const diff = (parseInt(pa[i], 10) || 0) - (parseInt(pb[i], 10) || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

// Pull request references such as " (#1827)" or " (#1814, #1761)" are for
// maintainers and are left out of the text shown in the app.
const PR_REFERENCES = /\s*\((?:#\d+(?:,\s*)?)+\)/g;
// A line made only of links, such as "[Full changelog](...)".
const LINK_ONLY_LINE = /^\s*(\[[^\]]+\]\([^)]+\)\s*\/?\s*)+$/;

/**
 * Splits docs/{lang}/RELEASE_NOTES.md into releases. Each "## " heading that
 * names a version (vX.Y.Z) is a release; other "## " headings, such as the
 * upcoming release ("Upcoming (v5.6.0)"), are skipped because their changes
 * are not released yet. The first "### " subsection of a release is taken as
 * its highlights.
 */
export const parseReleaseNotes = (markdown: string): ReleaseNote[] => {
  const notes: ReleaseNote[] = [];
  const sections = markdown.replace(/<!--[\s\S]*?-->/g, '').split(/^## /m);

  for (const section of sections.slice(1)) {
    const [heading, ...body] = section.split('\n');
    if (!/^v\d/.test(heading.trim())) continue;
    const versions = [...heading.matchAll(VERSION_PATTERN)].map((m) => m[1]);

    const subsections = body.join('\n').split(/^### /m);
    if (subsections.length < 2) continue;
    const highlights = subsections[1]
      .split('\n')
      .slice(1)
      .filter((line) => !LINK_ONLY_LINE.test(line))
      .join('\n')
      .replace(PR_REFERENCES, '')
      .trim();
    if (!highlights) continue;

    notes.push({ title: heading.trim(), versions, highlights });
  }
  return notes;
};

/**
 * The releases included in the deployed version, newest first. A release
 * heading with a range (v5.1.0 - v5.1.2) is included when its first version
 * is not newer than the deployed one. Without a known version, nothing is
 * shown.
 */
export const releasedNotes = (
  notes: ReleaseNote[],
  localVersion: string | undefined
): ReleaseNote[] => {
  if (!localVersion) return [];
  return notes.filter(
    (note) =>
      note.versions.length > 0 &&
      compareVersions(note.versions[0], localVersion) <= 0
  );
};
