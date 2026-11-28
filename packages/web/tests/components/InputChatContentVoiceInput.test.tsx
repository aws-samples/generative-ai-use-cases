import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InputChatContent from '../../src/components/InputChatContent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ja' } }),
}));

vi.mock('../../src/hooks/useChat', () => ({
  default: () => ({ loading: false, isEmpty: true }),
}));

vi.mock('../../src/hooks/useFiles', () => ({
  default: () => ({
    uploadedFiles: [],
    uploadFiles: vi.fn(),
    checkFiles: vi.fn(),
    deleteUploadedFile: vi.fn(),
    uploading: false,
    errorMessages: [],
  }),
}));

// A browser with a microphone, so only the settings decide the button
vi.mock('../../src/hooks/useVoiceInput', () => ({
  voiceInputEnabled: true,
  default: () => ({
    supported: true,
    status: 'idle',
    error: null,
    toggle: vi.fn(),
  }),
}));

// The textarea resizes itself with ResizeObserver, which jsdom does not have
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const renderInput = (voiceInput = true) =>
  render(
    <MemoryRouter>
      <InputChatContent
        content=""
        onChangeContent={() => {}}
        onSend={() => {}}
        hideReset
        voiceInput={voiceInput}
      />
    </MemoryRouter>
  );

describe('InputChatContent voice input button', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the microphone button by default', () => {
    renderInput();
    expect(screen.getByText('inputs.voice_input')).toBeTruthy();
  });

  it('hides it when the user turns it off on the Settings page', () => {
    localStorage.setItem('showVoiceInput', 'false');
    renderInput();
    expect(screen.queryByText('inputs.voice_input')).toBeNull();
  });

  it('does not show it on an input that does not ask for it', () => {
    renderInput(false);
    expect(screen.queryByText('inputs.voice_input')).toBeNull();
  });
});
