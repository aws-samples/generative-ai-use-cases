import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanguageCode } from '@aws-sdk/client-transcribe-streaming';
import useScreenAudio from '../../src/hooks/useScreenAudio';

const mocks = vi.hoisted(() => ({
  sendMock: vi.fn(),
  destroyMock: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
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

interface MockTrack {
  kind: string;
  readyState: string;
  stop: () => void;
  clone: () => MockTrack;
}

const createMockTrack = (kind = 'audio'): MockTrack => {
  const track: MockTrack = {
    kind,
    readyState: 'live',
    stop: vi.fn(() => {
      track.readyState = 'ended';
    }),
    clone: vi.fn(() => createMockTrack(kind)),
  };
  return track;
};

const createMockDisplayStream = (audioTrack: MockTrack) =>
  ({
    getAudioTracks: () => (audioTrack.kind === 'audio' ? [audioTrack] : []),
    getVideoTracks: () => [],
    getTracks: () => [audioTrack],
  }) as unknown as MediaStream;

class MockMediaStream {
  tracks: MockTrack[];
  constructor(tracks: MockTrack[]) {
    this.tracks = tracks;
  }
  getTracks() {
    return this.tracks;
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video');
  }
}

const renderReadyHook = async () => {
  const rendered = renderHook(() => useScreenAudio());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return rendered;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('MediaStream', MockMediaStream);
  Object.defineProperty(window.navigator, 'mediaDevices', {
    value: { getDisplayMedia: vi.fn() },
    configurable: true,
  });
});

afterEach(() => {
  pendingResolvers.splice(0).forEach((resolve) => resolve());
  vi.unstubAllGlobals();
});

describe('useScreenAudio auto reconnection', () => {
  it('reconnects automatically while the capture track is still live', async () => {
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

    const audioTrack = createMockTrack();
    const displayStream = createMockDisplayStream(audioTrack);

    const { result } = await renderReadyHook();

    act(() => {
      void result.current.startTranscriptionWithStream(
        displayStream,
        'ja-JP' as LanguageCode
      );
    });

    await waitFor(() => expect(mocks.sendMock).toHaveBeenCalledTimes(2), {
      timeout: 10000,
    });

    expect(result.current.recording).toBe(true);
    expect(result.current.rawTranscripts).toHaveLength(1);
    expect(result.current.rawTranscripts[0].transcripts[0].transcript).toBe(
      'first session'
    );
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

  it('notifies the user and stops when the capture track has ended', async () => {
    mocks.sendMock.mockResolvedValue(streamResponse([], { end: false }));

    const audioTrack = createMockTrack();
    const displayStream = createMockDisplayStream(audioTrack);

    const { result } = await renderReadyHook();

    act(() => {
      void result.current.startTranscriptionWithStream(
        displayStream,
        'ja-JP' as LanguageCode
      );
    });

    await waitFor(() => expect(mocks.sendMock).toHaveBeenCalledTimes(1));

    // The user stops sharing the screen: the source track ends and the
    // transcription stream terminates
    audioTrack.readyState = 'ended';
    await act(async () => {
      pendingResolvers.splice(0).forEach((resolve) => resolve());
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    await waitFor(
      () =>
        expect(mocks.toastWarning).toHaveBeenCalledWith(
          'transcribe.audio_source_lost'
        ),
      { timeout: 10000 }
    );
    await waitFor(() => expect(result.current.recording).toBe(false));
    // No reconnection is attempted since the source is gone
    expect(mocks.sendMock).toHaveBeenCalledTimes(1);
  }, 15000);
});
