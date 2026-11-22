import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  parseReleaseNotes,
  releasedNotes,
} from '../../src/utils/releaseNotes';
import releaseNotesEn from '../../../../docs/en/RELEASE_NOTES.md?raw';
import releaseNotesJa from '../../../../docs/ja/RELEASE_NOTES.md?raw';

const SAMPLE = `# Release Notes

<!-- A comment that is not shown. -->

## Upcoming (v5.6.0)

### Highlights

- Not released yet (#1900)

## v5.5.0 (2026-07-19)

### Highlights

- **New feature** (#1800, #1801)
- Another one

[Full changelog](https://example.com/v5.5.0)

### Before you update

- For admins only

## v5.1.0 - v5.1.2 (2025-08-29 - 2025-09-11)

### Highlights

- Patch releases

[v5.1.0](https://example.com/a) / [v5.1.2](https://example.com/b)
`;

describe('compareVersions', () => {
  it('compares each part as a number', () => {
    expect(compareVersions('5.10.0', '5.9.9')).toBeGreaterThan(0);
    expect(compareVersions('5.5.0', '5.6.0')).toBeLessThan(0);
    expect(compareVersions('v5.6.0', '5.6.0')).toBe(0);
    expect(compareVersions('6.0.0', '5.99.99')).toBeGreaterThan(0);
  });
});

describe('parseReleaseNotes', () => {
  const notes = parseReleaseNotes(SAMPLE);

  it('skips the upcoming release', () => {
    expect(notes.map((n) => n.title)).toEqual([
      'v5.5.0 (2026-07-19)',
      'v5.1.0 - v5.1.2 (2025-08-29 - 2025-09-11)',
    ]);
  });

  it('keeps only the highlights, without pull request references or link lines', () => {
    expect(notes[0].highlights).toBe('- **New feature**\n- Another one');
    expect(notes[1].highlights).toBe('- Patch releases');
  });

  it('keeps lines that mix links and text, and handles an unclosed comment', () => {
    const [note] = parseReleaseNotes(
      '## v1.0.0\n\n### Highlights\n\n- See [docs](https://example.com) for details\n<!-- a\n<!-- b -->\n- Hidden? no\n'
    );
    expect(note.highlights).toBe(
      '- See [docs](https://example.com) for details\n\n- Hidden? no'
    );
    expect(
      parseReleaseNotes('## v1.0.0\n\n### Highlights\n\n- A\n<!-- open')
    ).toEqual([{ title: 'v1.0.0', versions: ['1.0.0'], highlights: '- A' }]);
  });

  it('reads every version in the heading', () => {
    expect(notes[1].versions).toEqual(['5.1.0', '5.1.2']);
  });
});

describe('releasedNotes', () => {
  const notes = parseReleaseNotes(SAMPLE);

  it('shows the releases up to the deployed version', () => {
    expect(releasedNotes(notes, '5.5.0').map((n) => n.versions[0])).toEqual([
      '5.5.0',
      '5.1.0',
    ]);
    expect(releasedNotes(notes, '5.4.0').map((n) => n.versions[0])).toEqual([
      '5.1.0',
    ]);
    expect(releasedNotes(notes, '5.1.1').map((n) => n.versions[0])).toEqual([
      '5.1.0',
    ]);
  });

  it('shows nothing without a version', () => {
    expect(releasedNotes(notes, undefined)).toEqual([]);
  });
});

describe('docs/*/RELEASE_NOTES.md', () => {
  const en = parseReleaseNotes(releaseNotesEn);
  const ja = parseReleaseNotes(releaseNotesJa);

  it('has the same releases in English and Japanese', () => {
    expect(en.length).toBeGreaterThan(0);
    expect(ja.map((n) => n.versions)).toEqual(en.map((n) => n.versions));
  });

  it('starts every release with its highlights', () => {
    for (const [markdown, title] of [
      [releaseNotesEn, 'Highlights'],
      // eslint-disable-next-line i18nhelper/no-jp-string
      [releaseNotesJa, '主な変更'],
    ]) {
      const releases = markdown.split(/^## /m).slice(1);
      for (const release of releases.filter((r) => /^v\d/.test(r))) {
        const firstSubsection = release.split(/^### /m)[1] ?? '';
        expect(firstSubsection.split('\n')[0]).toBe(title);
      }
    }
  });
});
