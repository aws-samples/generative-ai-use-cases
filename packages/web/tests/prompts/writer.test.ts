import { describe, expect, it, vi } from 'vitest';
import { generateWriterPrompt, WriterOption } from '../../src/prompts/writer';

// useModel parses VITE_APP_* at import time; the prompt builder only needs MODELS.searchAgent
vi.mock('../../src/hooks/useModel', () => ({ MODELS: { searchAgent: '' } }));

// Options that go to Bedrock text models (search/collectData/factCheck use a Bedrock Agent)
const bedrockOptions: WriterOption[] = [
  'continue',
  'improve',
  'shorter',
  'longer',
  'fix',
  'zap',
  'comment',
];

describe('generateWriterPrompt', () => {
  it.each(bedrockOptions)(
    'should end the %s conversation with a user message (no assistant prefill)',
    (option) => {
      const { messages } = generateWriterPrompt(
        '<mark>text</mark>',
        option,
        'cmd'
      );
      expect(messages[messages.length - 1].role).toBe('user');
      expect(messages.some((m) => m.role === 'assistant')).toBe(false);
    }
  );

  it.each(bedrockOptions)(
    'should instruct %s to enclose the answer in <output></output> tags',
    (option) => {
      const { messages } = generateWriterPrompt('text', option, 'cmd');
      const system = messages.find((m) => m.role === 'system');
      expect(system?.content).toContain('<output></output>');
    }
  );
});
