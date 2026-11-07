import { describe, it, expect, beforeEach } from 'vitest';
import useChatPreferences, {
  pickInitialModelId,
} from '../../src/hooks/useChatPreferences';

describe('pickInitialModelId', () => {
  const available = ['model-a', 'model-b'];

  it('uses the remembered model when it is still offered', () => {
    expect(pickInitialModelId('model-b', available)).toBe('model-b');
  });

  it('falls back to the default when the remembered model was removed', () => {
    expect(pickInitialModelId('model-gone', available)).toBe('model-a');
  });

  it('uses the default when nothing is remembered', () => {
    expect(pickInitialModelId(undefined, available)).toBe('model-a');
  });
});

describe('useChatPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
    useChatPreferences.setState({
      modelId: undefined,
      reasoningConfig: undefined,
    });
  });

  it('stores the model and reasoning settings in localStorage', () => {
    useChatPreferences.getState().setModelId('model-b');
    useChatPreferences.getState().setReasoningConfig({
      type: 'enabled',
      budgetTokens: 8192,
    });
    const stored = JSON.parse(localStorage.getItem('chatPreferences')!);
    expect(stored.state).toEqual({
      modelId: 'model-b',
      reasoningConfig: { type: 'enabled', budgetTokens: 8192 },
    });
  });
});
