import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('../../src/hooks/useHttp', () => ({
  default: () => ({ get }),
}));

import { useSkillsForChat } from '../../src/hooks/agentBuilder/useAgentSkills';

const content = { name: 'report', description: 'd', instructions: 'i' };

describe('useSkillsForChat', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockReturnValue({ data: { skills: [content] }, isLoading: false });
  });

  it("reads the user's own agent's skills by the IDs it lists", () => {
    const { result } = renderHook(() =>
      useSkillsForChat({
        agentId: 'a1',
        isMyAgent: true,
        skillIds: ['s1', 's2'],
      })
    );

    expect(get).toHaveBeenCalledWith('agents/skills/contents?skillIds=s1,s2');
    expect(result.current.skills).toEqual([content]);
  });

  it("reads another user's agent's skills through the agent", () => {
    renderHook(() =>
      useSkillsForChat({ agentId: 'a1', isMyAgent: false, skillIds: [] })
    );

    expect(get).toHaveBeenCalledWith('agents/a1/skills');
  });

  it("asks for nothing when the user's agent has no skills", () => {
    get.mockReturnValue({ data: undefined, isLoading: false });
    const { result } = renderHook(() =>
      useSkillsForChat({ agentId: 'a1', isMyAgent: true, skillIds: [] })
    );

    expect(get).toHaveBeenCalledWith(null);
    expect(result.current.skills).toEqual([]);
  });
});
