import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanguageCode } from '@aws-sdk/client-transcribe-streaming';
import useMicrophone from '../../src/hooks/useMicrophone';

const mocks = vi.hoisted(() => ({
  sendMock: vi.fn(),
  destroyMock: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
  getUserMediaMock: vi.fn(),
}));

vi.mock('@aws-sdk/client-transcribe-streaming', () => {
  class TranscribeStreamingClient {
    send = mocks.sendMock;
    destroy = mocks.destroyMock;
  }
  class StartStreamTranscriptionCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return { TranscribeStreamingClient, StartStreamTranscriptionCommand };
});

vi.mock('microphone-stream', () => {
  class MockMicrophoneStream {
    setStream() {}
    stop() {}
    static toRaw(chunk: unknown) {
      return chunk;
    }
    [Symbol.asyncIterator]() {
      // Never yields audio chunks (the SDK mock does not consume audio anyway)
      return {
        next: () => new Promise<never>(() => {}),
      };
    }
  }
  return { default: MockMicrophoneStream };
});

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: { idToken: { toString: () => 'test-token' } },
  }),
}));

vi.mock('@aws-sdk/credential-provider-cognito-identity', () => ({
  fromCognitoIdentityPool: () => async () => ({
    accessKeyId: 'test',
    secretAccessKey: 'test',
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    info: mocks.toastInfo,
    error: mocks.toastError,
    warning: mocks.toastWarning,
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Resolvers to release never-ending mocked streams at test teardown
const pendingResolvers: Array<() => void> = [];

const transcriptEvent = (opts: {
  resultId: string;
  isPartial: boolean;
  startTime?: number;
  endTime?: number;
  transcript?: string;
}) => ({
  TranscriptEvent: {
    Transcript: {
      Results: [
        {
          ResultId: opts.resultId,
          StartTime: opts.startTime ?? 0,
          EndTime: opts.endTime ?? 1,
          IsPartial: opts.isPartial,
          Alternatives: [
            {
              Items: [
                {
                  Type: 'pronunciation',
                  Content: opts.transcript ?? 'hello',
                },
              ],
            },
          ],
        },
      ],
    },
  },
});

// A mocked Transcribe response whose result stream yields the given events.
// With end=true the stream terminates afterwards (simulating a server-side
// stream termination). With end=false it stays open until test teardown.
const streamResponse = (
  events: ReturnType<typeof transcriptEvent>[],
  { end = true }: { end?: boolean } = {}
) => ({
  TranscriptResultStream: (async function* () {
    for (const event of events) {
      yield event;
    }
    if (!end) {
      await new Promise<void>((resolve) => pendingResolvers.push(resolve));
    }
  })(),
});

const renderReadyHook = async () => {
  const rendered = renderHook(() => useMicrophone());
  // Wait until the TranscribeStreamingClient is created from the auth session
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return rendered;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserMediaMock.mockResolvedValue({} as MediaStream);
  Object.defineProperty(window.navigator, 'mediaDevices', {
    value: { getUserMedia: mocks.getUserMediaMock },
    configurable: true,
  });
});

afterEach(() => {
  // Release any streams still open so dangling promises settle
  pendingResolvers.splice(0).forEach((resolve) => resolve());
});

describe('useMicrophone auto reconnection', () => {
  it('reconnects automatically when the stream ends without a user stop', async () => {
    mocks.sendMock
      .mockResolvedValueOnce(
        streamResponse([
          transcriptEvent({
            resultId: 'r1',
            isPartial: false,
            startTime: 0,
            endTime: 2,
            transcript: 'first session',
          }),
        ])
      )
      .mockResolvedValue(streamResponse([], { end: false }));

    const { result } = await renderReadyHook();

    act(() => {
      void result.current.startTranscription('ja-JP' as LanguageCode);
    });

    // The first connection ends unexpectedly -> a second connection is made
    await waitFor(() => expect(mocks.sendMock).toHaveBeenCalledTimes(2), {
      timeout: 10000,
    });

    // Recording continues and the transcript from the first session is kept
    expect(result.current.recording).toBe(true);
    expect(result.current.rawTranscripts).toHaveLength(1);
    expect(result.current.rawTranscripts[0].transcripts[0].transcript).toBe(
      'first session'
    );
    // The user is notified about the reconnection
    expect(mocks.toastInfo).toHaveBeenCalledWith('transcribe.reconnecting');

    // Stop the session so the loop does not leak into other tests
    act(() => {
      result.current.stopTranscription();
    });
    await act(async () => {
      pendingResolvers.splice(0).forEach((resolve) => resolve());
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  }, 15000);

  it('keeps previous transcripts and finalizes the last partial segment on reconnect', async () => {
    mocks.sendMock
      .mockResolvedValueOnce(
        streamResponse([
          transcriptEvent({
            resultId: 'r1',
            isPartial: true,
            startTime: 0,
            endTime: 2,
            transcript: 'first session',
          }),
        ])
      )
      .mockResolvedValue(
        streamResponse(
          [
            transcriptEvent({
              resultId: 'r2',
              isPartial: false,
              startTime: 0,
              endTime: 3,
              transcript: 'second session',
            }),
          ],
          { end: false }
        )
      );

    const { result } = await renderReadyHook();

    act(() => {
      void result.current.startTranscription('ja-JP' as LanguageCode);
    });

    await waitFor(() => expect(result.current.rawTranscripts).toHaveLength(2), {
      timeout: 10000,
    });

    const [first, second] = result.current.rawTranscripts;
    // The transcript from before the reconnection is not lost
    expect(first.transcripts[0].transcript).toBe('first session');
    // The dangling partial segment is finalized so it is not overwritten
    expect(first.isPartial).toBe(false);
    expect(second.transcripts[0].transcript).toBe('second session');
    // Timestamps stay monotonic across reconnections
    expect(second.startTime).toBeGreaterThanOrEqual(first.endTime);

    // Stop the session so the loop does not leak into other tests
    act(() => {
      result.current.stopTranscription();
    });
    await act(async () => {
      pendingResolvers.splice(0).forEach((resolve) => resolve());
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  }, 15000);

  it('notifies the user and stops after reconnection retries are exhausted', async () => {
    mocks.sendMock
      .mockResolvedValueOnce(
        streamResponse([
          transcriptEvent({
            resultId: 'r1',
            isPartial: false,
            startTime: 0,
            endTime: 2,
            transcript: 'first session',
          }),
        ])
      )
      .mockRejectedValue(new Error('connection failed'));

    const { result } = await renderReadyHook();

    act(() => {
      void result.current.startTranscription('ja-JP' as LanguageCode);
    });

    await waitFor(
      () =>
        expect(mocks.toastError).toHaveBeenCalledWith(
          'transcribe.reconnect_failed'
        ),
      { timeout: 15000 }
    );
    await waitFor(() => expect(result.current.recording).toBe(false));
    // 1 initial connection + 3 reconnection attempts
    expect(mocks.sendMock).toHaveBeenCalledTimes(4);
    // Transcripts are still kept after giving up
    expect(result.current.rawTranscripts).toHaveLength(1);
  }, 20000);

  it('does not reconnect when the user stops the transcription', async () => {
    mocks.sendMock.mockResolvedValue(streamResponse([], { end: false }));

    const { result } = await renderReadyHook();

    act(() => {
      void result.current.startTranscription('ja-JP' as LanguageCode);
    });

    await waitFor(() => expect(mocks.sendMock).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.stopTranscription();
    });
    expect(result.current.recording).toBe(false);

    // Let the (mocked) stream end after the user stop
    await act(async () => {
      pendingResolvers.splice(0).forEach((resolve) => resolve());
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // No reconnection is attempted and no notification is shown
    expect(mocks.sendMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastInfo).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  }, 10000);
});
