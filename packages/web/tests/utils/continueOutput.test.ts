import { describe, expect, it } from 'vitest';
import { ShownMessage } from 'generative-ai-use-cases';
import {
  CONTINUE_OUTPUT_PROMPT,
  withContinueRequest,
} from '../../src/utils/continueOutput';

describe('withContinueRequest', () => {
  const messages: ShownMessage[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Count from 1 to 10.' },
    { role: 'assistant', content: '1, 2, 3, 4, 5, ' },
  ];

  it('ends the conversation with a user message (no assistant prefill)', () => {
    const result = withContinueRequest(messages);
    expect(result[result.length - 1]).toEqual({
      role: 'user',
      content: CONTINUE_OUTPUT_PROMPT,
    });
  });

  it('keeps the earlier messages as they were, including the cut-off response', () => {
    const result = withContinueRequest(messages);
    expect(result.slice(0, -1)).toEqual(messages);
  });

  it('does not change the messages it is given', () => {
    const copy = structuredClone(messages);
    withContinueRequest(messages);
    expect(messages).toEqual(copy);
  });
});
