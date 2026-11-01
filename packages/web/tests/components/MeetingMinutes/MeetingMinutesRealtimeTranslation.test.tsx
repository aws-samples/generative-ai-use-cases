import React from 'react';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MeetingMinutesRealtimeTranslation from '../../../src/components/MeetingMinutes/MeetingMinutesRealtimeTranslation';

// Raw transcript segment shape returned by useMicrophone
interface RawSegment {
  resultId: string;
  startTime: number;
  endTime: number;
  isPartial: boolean;
  transcripts: { speakerLabel?: string; transcript: string }[];
  languageCode?: string;
}

// Hoisted mutable mock state (vi.mock factories are hoisted above imports)
const { translateMock, micState } = vi.hoisted(() => {
  return {
    translateMock: vi.fn(async (): Promise<string | null> => 'translated-text'),
    micState: {
      recording: false,
      rawTranscripts: [] as {
        resultId: string;
        startTime: number;
        endTime: number;
        isPartial: boolean;
        transcripts: { speakerLabel?: string; transcript: string }[];
        languageCode?: string;
      }[],
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../src/hooks/useMicrophone', () => ({
  default: () => ({
    startTranscription: vi.fn(),
    stopTranscription: vi.fn(),
    recording: micState.recording,
    clearTranscripts: vi.fn(),
    rawTranscripts: micState.rawTranscripts,
  }),
}));

vi.mock('../../../src/hooks/useScreenAudio', () => ({
  default: () => ({
    prepareScreenCapture: vi.fn(),
    startTranscriptionWithStream: vi.fn(),
    stopTranscription: vi.fn(),
    recording: false,
    clearTranscripts: vi.fn(),
    isSupported: false,
    error: null,
    rawTranscripts: [],
  }),
}));

vi.mock('../../../src/hooks/useRealtimeTranslation', () => ({
  default: () => ({
    availableModels: ['model-a'],
    translate: translateMock,
    translationInterval: 100,
    setTranslationInterval: vi.fn(),
    hasTextChanged: vi.fn(),
  }),
}));

vi.mock('../../../src/hooks/useChatApi', () => ({
  default: () => ({
    predict: vi.fn(async () => ''),
  }),
}));

vi.mock('../../../src/hooks/useModel', () => ({
  MODELS: {
    modelIds: ['model-a'],
    lightModelIds: [],
    modelDisplayName: (id: string) => id,
  },
  findModelByModelId: () => undefined,
}));

vi.mock('../../../src/components/Select', () => ({
  default: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('../../../src/components/Textarea', () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => <textarea value={value} onChange={(e) => onChange(e.target.value)} />,
}));

vi.mock(
  '../../../src/components/MeetingMinutes/MeetingMinutesSettingsPanel',
  () => ({
    default: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
  })
);

vi.mock(
  '../../../src/components/MeetingMinutes/MeetingMinutesControlButtons',
  () => ({
    default: ({
      onStartRecording,
      onStopRecording,
    }: {
      onStartRecording: () => void;
      onStopRecording: () => void;
    }) => (
      <div>
        <button data-testid="start-recording" onClick={onStartRecording} />
        <button data-testid="stop-recording" onClick={onStopRecording} />
      </div>
    ),
  })
);

vi.mock(
  '../../../src/components/MeetingMinutes/MeetingMinutesTranscriptSegment',
  () => ({
    default: () => null,
  })
);

// Combobox render order in the component:
// [0] = primary (transcription) language, [1] = secondary (translation) language,
// [2] = translation type, [3] = translation model
const PRIMARY_LANGUAGE_SELECT = 0;
const SECONDARY_LANGUAGE_SELECT = 1;

const feedMicSegment = (segment: RawSegment) => {
  micState.rawTranscripts = [...micState.rawTranscripts, segment];
};

describe('MeetingMinutesRealtimeTranslation - translation target language', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    translateMock.mockClear();
    micState.recording = false;
    micState.rawTranscripts = [];
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('uses the user-selected target language and recent context on the FIRST recording (Issue #1331)', async () => {
    const { rerender } = render(<MeetingMinutesRealtimeTranslation />);

    // User configures: transcription = Japanese, translation = English
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[PRIMARY_LANGUAGE_SELECT], {
      target: { value: 'ja-JP' },
    });
    fireEvent.change(selects[SECONDARY_LANGUAGE_SELECT], {
      target: { value: 'en-US' },
    });

    // First recording starts
    fireEvent.click(screen.getByTestId('start-recording'));

    // A finalized transcript segment arrives from the microphone
    feedMicSegment({
      resultId: 'r1',
      startTime: 0,
      endTime: 2,
      isPartial: false,
      transcripts: [{ transcript: 'first recording sentence?' }],
      languageCode: 'ja-JP',
    });
    rerender(<MeetingMinutesRealtimeTranslation />);

    // Let the interval-based translation fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(translateMock).toHaveBeenCalled();
    const [text, , targetLanguage, context] = translateMock.mock.calls[0];
    expect(text).toBe('first recording sentence?');
    // Bug: stale closure captured the initial default ('ja-JP' -> 'Japanese')
    expect(targetLanguage).toBe('English');
    // Bug: stale empty segments meant no recent-context (<consider>) was sent
    expect(context).toContain('first recording sentence');
  });

  it('keeps following the latest language setting on subsequent recordings', async () => {
    const { rerender } = render(<MeetingMinutesRealtimeTranslation />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[PRIMARY_LANGUAGE_SELECT], {
      target: { value: 'ja-JP' },
    });
    fireEvent.change(selects[SECONDARY_LANGUAGE_SELECT], {
      target: { value: 'en-US' },
    });

    // First recording
    fireEvent.click(screen.getByTestId('start-recording'));
    feedMicSegment({
      resultId: 'r1',
      startTime: 0,
      endTime: 2,
      isPartial: false,
      transcripts: [{ transcript: 'first recording sentence?' }],
      languageCode: 'ja-JP',
    });
    rerender(<MeetingMinutesRealtimeTranslation />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(translateMock).toHaveBeenCalled();
    expect(translateMock.mock.calls[0][2]).toBe('English');

    // Stop, change the translation language, then record again
    fireEvent.click(screen.getByTestId('stop-recording'));
    fireEvent.change(selects[SECONDARY_LANGUAGE_SELECT], {
      target: { value: 'zh-CN' },
    });
    fireEvent.click(screen.getByTestId('start-recording'));

    feedMicSegment({
      resultId: 'r2',
      startTime: 10,
      endTime: 12,
      isPartial: false,
      transcripts: [{ transcript: 'second recording sentence?' }],
      languageCode: 'ja-JP',
    });
    rerender(<MeetingMinutesRealtimeTranslation />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    const secondRecordingCall = translateMock.mock.calls.find(
      (call) => call[0] === 'second recording sentence?'
    );
    expect(secondRecordingCall).toBeDefined();
    // The second recording must use the latest setting (Chinese)
    expect(secondRecordingCall?.[2]).toBe('Chinese');
  });
});
