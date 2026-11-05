import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import queryString from 'query-string';
import { describe, expect, it, vi } from 'vitest';
import MeetingMinutesGeneration from '../../../src/components/MeetingMinutes/MeetingMinutesGeneration';

// Captures the setGeneratedMinutes setter that the component passes to useMeetingMinutes
let capturedSetGeneratedMinutes: ((minutes: string) => void) | null = null;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('copy-to-clipboard', () => ({
  default: () => true,
  __esModule: true,
}));

vi.mock('../../../src/hooks/useInterUseCases', () => ({
  default: () => ({
    setCopyTemporary: vi.fn(),
  }),
  __esModule: true,
}));

vi.mock('../../../src/hooks/useMeetingMinutes', () => ({
  default: (
    _style: string,
    _customPrompt: string,
    _sessionTimestamp: number | null,
    setGeneratedMinutes: (minutes: string) => void
  ) => {
    capturedSetGeneratedMinutes = setGeneratedMinutes;
    return {
      loading: false,
      generateMinutes: vi.fn(),
      clearMinutes: vi.fn(),
    };
  },
  __esModule: true,
}));

vi.mock('../../../src/hooks/useMeetingMinutesCustomPromptApi', () => ({
  default: () => ({
    listMeetingMinutesCustomPrompts: () => ({
      data: [],
      mutate: vi.fn(),
    }),
    createMeetingMinutesCustomPrompt: vi.fn(),
    updateMeetingMinutesCustomPrompt: vi.fn(),
    deleteMeetingMinutesCustomPrompt: vi.fn(),
  }),
  __esModule: true,
}));

vi.mock('../../../src/hooks/useModel', () => ({
  MODELS: {
    modelIds: ['test-model'],
    modelDisplayName: (id: string) => id,
  },
  __esModule: true,
}));

vi.mock('../../../src/hooks/useUseCases', () => ({
  default: () => ({
    enabled: () => true,
  }),
  __esModule: true,
}));

vi.mock('../../../src/prompts/claude', () => ({
  claudePrompter: {
    meetingMinutesPrompt: () => 'system prompt',
  },
  __esModule: true,
}));

vi.mock('../../../src/components/Markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
  __esModule: true,
}));

vi.mock(
  '../../../src/components/MeetingMinutes/MeetingMinutesSettingsModal',
  () => ({
    default: () => null,
    __esModule: true,
  })
);

const GENERATED_MINUTES = '# Meeting Minutes\n\n- Decision A\n- Action B';

// Stub for the Writer use case page (/writer) that shows the received sentence
const WriterPageStub: React.FC = () => {
  const { search } = useLocation();
  const params = queryString.parse(search) as { sentence?: string };
  return <div data-testid="writer-page">{params.sentence ?? ''}</div>;
};

// Catch-all stub emulating the NotFound (404) route
const NotFoundStub: React.FC = () => (
  // eslint-disable-next-line @shopify/jsx-no-hardcoded-content
  <div data-testid="not-found">404</div>
);

const renderComponent = () => {
  return render(
    <MemoryRouter initialEntries={['/meeting-minutes']}>
      <Routes>
        <Route
          path="/meeting-minutes"
          element={<MeetingMinutesGeneration transcriptText="hello" />}
        />
        <Route path="/writer" element={<WriterPageStub />} />
        <Route path="*" element={<NotFoundStub />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('MeetingMinutesGeneration edit button (issue #1330)', () => {
  it('shows an edit button for generated minutes', () => {
    renderComponent();

    act(() => {
      capturedSetGeneratedMinutes?.(GENERATED_MINUTES);
    });

    expect(screen.getByTitle('meetingMinutes.edit_in_writer')).toBeTruthy();
  });

  it('navigates to an existing route (/writer) with the minutes body, not 404', () => {
    renderComponent();

    act(() => {
      capturedSetGeneratedMinutes?.(GENERATED_MINUTES);
    });

    fireEvent.click(screen.getByTitle('meetingMinutes.edit_in_writer'));

    // Must not land on the catch-all (404) route
    expect(screen.queryByTestId('not-found')).toBeNull();

    // Must land on the Writer page with the minutes body carried over
    const writerPage = screen.getByTestId('writer-page');
    expect(writerPage.textContent).toBe(GENERATED_MINUTES);
  });
});
