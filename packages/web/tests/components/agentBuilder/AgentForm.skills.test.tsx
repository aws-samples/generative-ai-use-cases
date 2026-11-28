import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentSkillSummary } from 'generative-ai-use-cases';

// i18n: return the key itself so assertions do not depend on translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../src/hooks/useModel', () => ({
  MODELS: {
    modelIds: ['test.model-1'],
    modelDisplayName: (modelId: string) => modelId,
  },
}));

vi.mock('../../../src/components/agentBuilder/MCPServerManager', () => ({
  default: () => <div data-testid="mcp-server-manager" />,
}));

vi.mock('../../../src/hooks/useMCPServers', () => ({
  default: () => [],
}));

vi.mock('../../../src/hooks/usePromptGeneration', () => ({
  default: () => ({
    generatedPrompt: '',
    suggestedMCPServers: [],
    suggestedBuiltInTools: [],
    isGenerating: false,
    generate: vi.fn(),
    cancel: vi.fn(),
  }),
}));

// The user's skills, set per test
const skillList = vi.hoisted(() => ({
  skills: [] as AgentSkillSummary[],
  isLoading: false,
}));

vi.mock('../../../src/hooks/agentBuilder/useAgentSkills', () => ({
  useSkillList: () => skillList,
}));

import AgentForm from '../../../src/components/agentBuilder/AgentForm';

const summary = (skillId: string, descriptionLength: number) => ({
  skillId,
  name: `skill-${skillId}`,
  description: 'x'.repeat(descriptionLength),
  createdAt: '',
  updatedAt: '',
});

const savedAgent = {
  name: 'Agent',
  systemPrompt: 'Help the user.',
  modelId: 'test.model-1',
};

const renderForm = (
  skillIds: string[],
  extra: { skillReturnTo?: string; onOpenSkill?: () => void } = {}
) => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <MemoryRouter>
      <AgentForm
        initialData={{ ...savedAgent, skillIds }}
        onSave={onSave}
        onCancel={vi.fn()}
        {...extra}
      />
    </MemoryRouter>
  );
  return { onSave };
};

const saveButton = () =>
  screen.getByRole('button', { name: 'common.create' }) as HTMLButtonElement;

describe('AgentForm skills', () => {
  beforeEach(() => {
    skillList.skills = [];
    skillList.isLoading = false;
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

  it('saves the skills given to the agent', () => {
    skillList.skills = [summary('a', 10), summary('b', 20)];
    const { onSave } = renderForm(['b']);

    expect(screen.getAllByTestId('attached-skill')).toHaveLength(1);
    // The name opens the skill in the same tab
    const link = screen.getByRole('link', { name: 'skill-b' });
    expect(link.getAttribute('href')).toBe('/agent-builder/skills/b/edit');
    expect(link.getAttribute('target')).toBeNull();
    fireEvent.click(saveButton());

    expect(onSave.mock.calls[0][0].skillIds).toEqual(['b']);
  });

  it('opens a skill to come back to the agent, keeping the edits first', () => {
    skillList.skills = [summary('a', 10)];
    const onOpenSkill = vi.fn();
    renderForm(['a'], {
      skillReturnTo: '/agent-builder/x1/edit',
      onOpenSkill,
    });

    const link = screen.getByRole('link', { name: 'skill-a' });
    expect(link.getAttribute('href')).toBe(
      '/agent-builder/skills/a/edit?returnTo=%2Fagent-builder%2Fx1%2Fedit'
    );
    fireEvent.click(link);
    expect(onOpenSkill).toHaveBeenCalled();
  });

  it('adds a skill from the dialog', () => {
    skillList.skills = [summary('a', 10), summary('b', 20)];
    const { onSave } = renderForm(['b']);

    fireEvent.click(
      screen.getByRole('button', { name: /agent_builder.add_skill/ })
    );
    const dialog = screen.getByRole('dialog');
    // A skill already given is not offered again
    expect(within(dialog).queryByText('skill-b')).toBeNull();
    fireEvent.click(within(dialog).getByText('skill-a'));
    fireEvent.click(saveButton());

    expect(onSave.mock.calls[0][0].skillIds).toEqual(['b', 'a']);
  });

  it('removes a skill', () => {
    skillList.skills = [summary('a', 10), summary('b', 20)];
    const { onSave } = renderForm(['a', 'b']);

    fireEvent.click(
      within(screen.getAllByTestId('attached-skill')[0]).getByRole('button')
    );
    fireEvent.click(saveButton());

    expect(onSave.mock.calls[0][0].skillIds).toEqual(['b']);
  });

  it('cannot save when the descriptions go over the limit', () => {
    skillList.skills = [summary('a', 6000), summary('b', 4001)];
    renderForm(['a', 'b']);

    expect(saveButton().disabled).toBe(true);
    expect(
      screen.getByText('agent_builder.skill_descriptions_over_limit')
    ).toBeDefined();
  });

  it('can save at the limit', () => {
    skillList.skills = [summary('a', 6000), summary('b', 4000)];
    renderForm(['a', 'b']);

    expect(saveButton().disabled).toBe(false);
  });

  it('cannot save while it lists a deleted skill', () => {
    skillList.skills = [summary('a', 10)];
    renderForm(['a', 'deleted']);

    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText('agent_builder.skill_deleted')).toBeDefined();
    expect(
      screen.getByText('agent_builder.remove_deleted_skills')
    ).toBeDefined();
  });

  it('cannot save before the skills are loaded', () => {
    skillList.isLoading = true;
    renderForm(['a']);

    expect(saveButton().disabled).toBe(true);
  });
});
