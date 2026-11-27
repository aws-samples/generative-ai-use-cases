import { describe, expect, test } from 'vitest';
import {
  SkillFileError,
  fromSkillFile,
  toSkillFile,
} from '../../src/utils/skillFile';

const skill = {
  name: 'weekly-report',
  description:
    'Use when writing the weekly report: sales, issues, "next steps"',
  instructions: '# Weekly report\n\n1. Collect the numbers\n2. Write it',
};

describe('SKILL.md', () => {
  test('writes frontmatter with the name and the description, then the instructions', () => {
    const text = toSkillFile(skill);
    expect(text.startsWith('---\nname: weekly-report\n')).toBe(true);
    expect(text).toContain('\n---\n\n# Weekly report\n');
  });

  test('reads back what it writes, colons and quotes included', () => {
    expect(fromSkillFile(toSkillFile(skill))).toEqual(skill);
  });

  test('reads a SKILL.md written elsewhere, leaving out fields a GenU skill has no place for', () => {
    const text = [
      '﻿---',
      'name: pdf-processing',
      'description: >-',
      '  Extract text and tables from PDF files.',
      '  Use when working with PDFs.',
      'license: Apache-2.0',
      'allowed-tools: Bash(python:*) Read',
      'metadata:',
      '  author: example',
      '---',
      '',
      '# PDF processing',
      '',
    ].join('\r\n');
    expect(fromSkillFile(text)).toEqual({
      name: 'pdf-processing',
      description:
        'Extract text and tables from PDF files. Use when working with PDFs.',
      instructions: '# PDF processing',
    });
  });

  test.each([
    ['no frontmatter', '# Just a heading'],
    ['no description', '---\nname: a\n---\nbody'],
    ['not YAML', '---\nname: [a\n---\nbody'],
    ['an unclosed frontmatter', '---\nname: a\ndescription: b\nbody'],
  ])('refuses a file with %s', (_, text) => {
    expect(() => fromSkillFile(text)).toThrow(SkillFileError);
  });
});
