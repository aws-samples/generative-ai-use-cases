import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { claudePrompter } from '../../src/prompts/claude';
import { MeetingMinutesParams } from '../../src/prompts';

// Capture the messages passed to predictStream so we can inspect
// which system prompt was actually sent to the model.
const predictStreamMock = vi.fn();

vi.mock('../../src/hooks/useChatApi', () => ({
  default: () => ({
    predictStream: (...args: unknown[]) => {
      predictStreamMock(...args);
      // Return an async iterable like the real implementation
      return (async function* () {
        yield JSON.stringify({ text: 'generated minutes' });
      })();
    },
    createChat: vi.fn().mockResolvedValue({ chat: { chatId: 'chat#test' } }),
    createMessages: vi.fn().mockResolvedValue({}),
    updateTitle: vi.fn().mockResolvedValue({}),
    predictTitle: vi.fn().mockResolvedValue('title'),
  }),
}));

vi.mock('../../src/hooks/useChatList', () => ({
  default: () => ({ mutate: vi.fn() }),
}));

vi.mock('../../src/hooks/useModel', () => ({
  MODELS: {
    modelIds: ['claude-test-model'],
    textModels: [{ modelId: 'claude-test-model', type: 'bedrock' }],
  },
  findModelByModelId: vi.fn().mockReturnValue({
    modelId: 'claude-test-model',
    type: 'bedrock',
  }),
}));

// Import after mocks are declared
import useMeetingMinutes from '../../src/hooks/useMeetingMinutes';

// The system prompt used for the 'transcription' style (the fallback
// reported in issue #1349 as being wrongly used for summary/detail)
const transcriptionPrompt = claudePrompter.meetingMinutesPrompt({
  style: 'transcription',
});

/**
 * Render the hook with a given style and run one generation,
 * returning the system prompt that was sent to predictStream.
 */
const generateAndGetSystemPrompt = async (
  style: MeetingMinutesParams['style'],
  customPrompt = ''
): Promise<string> => {
  predictStreamMock.mockClear();

  const { result } = renderHook(() =>
    useMeetingMinutes(
      style,
      customPrompt,
      null,
      () => {},
      () => {},
      () => {}
    )
  );

  await act(async () => {
    await result.current.generateMinutes(
      'This is a test transcript.',
      'claude-test-model'
    );
  });

  expect(predictStreamMock).toHaveBeenCalledTimes(1);
  const callArg = predictStreamMock.mock.calls[0][0] as {
    messages: { role: string; content: string }[];
  };
  const systemMessage = callArg.messages.find((m) => m.role === 'system');
  expect(systemMessage).toBeDefined();
  return systemMessage!.content;
};

describe('useMeetingMinutes style -> system prompt mapping (issue #1349)', () => {
  beforeEach(() => {
    predictStreamMock.mockClear();
  });

  it('uses the summary system prompt when style is "summary" (Summary)', async () => {
    const systemPrompt = await generateAndGetSystemPrompt('summary');
    // Must NOT fall back to the transcription prompt
    expect(systemPrompt).not.toBe(transcriptionPrompt);
    expect(systemPrompt).toContain('professional meeting facilitator');
  });

  it('uses the detail system prompt when style is "detail" (Detail)', async () => {
    const systemPrompt = await generateAndGetSystemPrompt('detail');
    expect(systemPrompt).not.toBe(transcriptionPrompt);
    expect(systemPrompt).toContain('professional secretary');
  });

  it('uses the faq system prompt when style is "faq" (FAQ)', async () => {
    const systemPrompt = await generateAndGetSystemPrompt('faq');
    expect(systemPrompt).not.toBe(transcriptionPrompt);
    expect(systemPrompt).toContain('question-and-answer');
  });

  it('uses the transcription system prompt when style is "transcription" (Transcription)', async () => {
    const systemPrompt = await generateAndGetSystemPrompt('transcription');
    expect(systemPrompt).toBe(transcriptionPrompt);
  });

  it('uses the user-provided prompt when style is "custom"', async () => {
    const systemPrompt = await generateAndGetSystemPrompt(
      'custom',
      'my custom prompt body'
    );
    expect(systemPrompt).toBe('my custom prompt body');
  });

  it('uses the saved prompt body when style is "savedPrompt:<id>"', async () => {
    const systemPrompt = await generateAndGetSystemPrompt(
      'savedPrompt:abc123',
      'my saved prompt body'
    );
    expect(systemPrompt).toBe('my saved prompt body');
  });
});

describe('claudePrompter.meetingMinutesPrompt style mapping (issue #1349)', () => {
  it.each([
    ['summary', 'professional meeting facilitator'],
    ['detail', 'professional secretary'],
    ['faq', 'question-and-answer'],
    ['newspaper', 'professional journalist'],
    ['diagram', 'visual documentation specialist'],
    ['whiteboard', 'whiteboard facilitator'],
  ] as const)(
    'returns a dedicated prompt (not the transcription fallback) for style "%s"',
    (style, expectedFragment) => {
      const prompt = claudePrompter.meetingMinutesPrompt({ style });
      expect(prompt).not.toBe(transcriptionPrompt);
      expect(prompt).toContain(expectedFragment);
    }
  );

  it('returns the custom prompt body for style "custom"', () => {
    expect(
      claudePrompter.meetingMinutesPrompt({
        style: 'custom',
        customPrompt: 'my prompt',
      })
    ).toBe('my prompt');
  });

  it('returns the saved prompt body for style "savedPrompt:<id>"', () => {
    expect(
      claudePrompter.meetingMinutesPrompt({
        style: 'savedPrompt:xyz',
        customPrompt: 'saved body',
      })
    ).toBe('saved body');
  });

  it.each([['custom'], ['savedPrompt:xyz']] as const)(
    'falls back to the transcription prompt when style is "%s" but the prompt body is empty',
    (style) => {
      expect(
        claudePrompter.meetingMinutesPrompt({ style, customPrompt: '' })
      ).toBe(transcriptionPrompt);
    }
  );
});
