import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const api = vi.hoisted(() => ({ createSkill: vi.fn() }));
vi.mock('../../../src/hooks/agentBuilder/useAgentSkills', () => ({
  useSkill: () => ({ skill: undefined, isLoading: false, error: undefined }),
  useSkillList: () => ({ mutate: vi.fn() }),
  useSkillApi: () => ({
    createSkill: api.createSkill,
    updateSkill: vi.fn(),
    deleteSkill: vi.fn(),
  }),
}));
vi.mock('../../../src/hooks/useLeaveGuard', () => ({
  default: () => ({ dialog: null, leave: vi.fn() }),
}));
vi.mock('../../../src/components/Markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

import SkillEditPage from '../../../src/pages/agentBuilder/SkillEditPage';

const SKILL_MD = [
  '---',
  'name: pdf-processing',
  'description: Use when working with PDF files.',
  'allowed-tools: Bash Read',
  '---',
  '',
  '# PDF processing',
].join('\n');

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/agent-builder/skills/create']}>
      <Routes>
        <Route
          path="/agent-builder/skills/create"
          element={<SkillEditPage />}
        />
        {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
        <Route path="/agent-builder/skills" element={<div>list</div>} />
      </Routes>
    </MemoryRouter>
  );

const chooseFile = async (text: string) => {
  const input = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  const file = new File([text], 'SKILL.md', { type: 'text/markdown' });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
};

beforeEach(() => {
  api.createSkill.mockReset();
  api.createSkill.mockResolvedValue({ skillId: 's1' });
  // The Textarea re-measures its height with a ResizeObserver, which jsdom lacks
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(function () {
      return { observe: vi.fn(), disconnect: vi.fn() };
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SkillEditPage with SKILL.md', () => {
  it('fills the form from a SKILL.md, and saves only when the user creates it', async () => {
    renderPage();
    await chooseFile(SKILL_MD);
    await waitFor(() =>
      expect(screen.getByDisplayValue('pdf-processing')).toBeTruthy()
    );
    expect(
      screen.getByDisplayValue('Use when working with PDF files.')
    ).toBeTruthy();
    expect(screen.getByDisplayValue('# PDF processing')).toBeTruthy();
    expect(api.createSkill).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText('common.create'));
    });
    expect(api.createSkill).toHaveBeenCalledWith({
      name: 'pdf-processing',
      description: 'Use when working with PDF files.',
      instructions: '# PDF processing',
    });
  });

  it('shows an error and keeps the form for a file that is not a SKILL.md', async () => {
    renderPage();
    await chooseFile('# no frontmatter');
    await waitFor(() =>
      expect(screen.getByText('agent_builder.skill_import_failed')).toBeTruthy()
    );
  });

  it('exports what the form holds as SKILL.md', async () => {
    let saved: Blob | undefined;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      saved = blob;
      return 'blob:skill';
    });
    URL.revokeObjectURL = vi.fn();
    renderPage();
    await chooseFile(SKILL_MD);
    await waitFor(() =>
      expect(screen.getByDisplayValue('pdf-processing')).toBeTruthy()
    );
    fireEvent.click(screen.getByText('agent_builder.skill_export'));
    const text = await saved!.text();
    expect(text).toContain('name: pdf-processing');
    expect(text).not.toContain('allowed-tools');
    expect(text.endsWith('# PDF processing\n')).toBe(true);
  });
});
