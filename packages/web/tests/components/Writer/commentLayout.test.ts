import { describe, it, expect } from 'vitest';
import { layoutCommentCards } from '../../../src/components/Writer/lib/commentLayout';

describe('layoutCommentCards', () => {
  it('puts each card at the line it points at when there is room', () => {
    expect(
      layoutCommentCards([
        { textTop: 0, height: 100 },
        { textTop: 220, height: 100 },
        { textTop: 480, height: 100 },
      ])
    ).toEqual({ tops: [0, 220, 480], height: 580 });
  });

  it('puts a card right below the previous one when that is in the way', () => {
    expect(
      layoutCommentCards([
        { textTop: 0, height: 200 },
        { textTop: 56, height: 200 },
        { textTop: 500, height: 100 },
      ])
    ).toEqual({ tops: [0, 200, 500], height: 600 });
  });

  it('puts a card whose text is gone right below the previous one', () => {
    expect(
      layoutCommentCards([
        { textTop: 40, height: 100 },
        { textTop: null, height: 80 },
      ])
    ).toEqual({ tops: [40, 140], height: 220 });
  });

  it('does not put a card above the top of the list', () => {
    // On narrow screens the list is below the editor, so the text is above it
    expect(
      layoutCommentCards([
        { textTop: -600, height: 100 },
        { textTop: -300, height: 100 },
      ])
    ).toEqual({ tops: [0, 100], height: 200 });
  });

  it('has no height without cards', () => {
    expect(layoutCommentCards([])).toEqual({ tops: [], height: 0 });
  });
});
