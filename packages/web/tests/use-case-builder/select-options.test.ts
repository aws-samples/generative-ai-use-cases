import { describe, expect, test } from 'vitest';
import { splitSelectOptions } from '../../src/utils/UseCaseBuilderUtils';

describe('splitSelectOptions', () => {
  test('splits options without spaces as before', () => {
    expect(splitSelectOptions('A,B,C')).toEqual(['A', 'B', 'C']);
  });

  test('drops spaces around each option', () => {
    expect(splitSelectOptions('A, B ,  C')).toEqual(['A', 'B', 'C']);
  });

  test('keeps spaces inside an option', () => {
    expect(splitSelectOptions('New York, Los Angeles')).toEqual([
      'New York',
      'Los Angeles',
    ]);
  });

  test('turns a whitespace-only option into an empty string', () => {
    // The view reports empty options as an error, so this must stay ''
    expect(splitSelectOptions('A, ,B')).toEqual(['A', '', 'B']);
  });

  test('exposes duplicates that differ only by spaces', () => {
    expect(splitSelectOptions('A, A')).toEqual(['A', 'A']);
  });

  test('returns an empty list when there are no options', () => {
    expect(splitSelectOptions(undefined)).toEqual([]);
    expect(splitSelectOptions('')).toEqual([]);
  });
});
