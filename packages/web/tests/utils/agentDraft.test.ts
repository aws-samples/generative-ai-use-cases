import { describe, it, expect, beforeEach } from 'vitest';
import {
  agentDraftKey,
  agentReturnPath,
  saveAgentDraft,
  skillPagePath,
  takeAgentDraft,
} from '../../src/utils/agentDraft';

describe('agent draft', () => {
  beforeEach(() => sessionStorage.clear());

  it('gives the draft back once, then forgets it', () => {
    saveAgentDraft(agentDraftKey('a1'), { name: 'Typed but not saved' });

    expect(takeAgentDraft(agentDraftKey('a1'))).toEqual({
      name: 'Typed but not saved',
    });
    expect(takeAgentDraft(agentDraftKey('a1'))).toBeNull();
  });

  it('keeps the drafts of a new agent and of each saved agent apart', () => {
    saveAgentDraft(agentDraftKey(), { name: 'new' });
    saveAgentDraft(agentDraftKey('a1'), { name: 'a1' });

    expect(takeAgentDraft(agentDraftKey('a2'))).toBeNull();
    expect(takeAgentDraft(agentDraftKey())).toEqual({ name: 'new' });
  });

  it('ignores a draft it cannot read', () => {
    sessionStorage.setItem(agentDraftKey('a1'), '{not json');
    expect(takeAgentDraft(agentDraftKey('a1'))).toBeNull();
  });
});

describe('agentReturnPath', () => {
  it('accepts the pages that edit an agent', () => {
    expect(agentReturnPath('/agent-builder/create')).toBe(
      '/agent-builder/create'
    );
    expect(agentReturnPath('/agent-builder/01a2-b3/edit')).toBe(
      '/agent-builder/01a2-b3/edit'
    );
  });

  it('refuses anything else, so a link cannot send the user elsewhere', () => {
    for (const value of [
      null,
      '',
      'https://example.com/agent-builder/create',
      '//example.com/agent-builder/create',
      '/agent-builder',
      '/agent-builder/skills',
      '/agent-builder/a1/edit?x=1',
      '/chat',
    ]) {
      expect(agentReturnPath(value)).toBeNull();
    }
  });
});

describe('skillPagePath', () => {
  it('adds where to come back to', () => {
    expect(
      skillPagePath('/agent-builder/skills/create', '/agent-builder/create')
    ).toBe('/agent-builder/skills/create?returnTo=%2Fagent-builder%2Fcreate');
    expect(skillPagePath('/agent-builder/skills/create')).toBe(
      '/agent-builder/skills/create'
    );
  });
});
