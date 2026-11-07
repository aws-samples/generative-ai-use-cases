import { describe, it, expect, beforeEach } from 'vitest';
import useChatPreferences, {
  pickInitialModelId,
  sanitizeReasoningConfig,
} from '../../src/hooks/useChatPreferences';

describe('sanitizeReasoningConfig', () => {
  it('keeps a valid stored config, including xhigh effort', () => {
    expect(
      sanitizeReasoningConfig({
        type: 'adaptive',
        budgetTokens: 8192,
        effort: 'xhigh',
      })
    ).toEqual({ type: 'adaptive', budgetTokens: 8192, effort: 'xhigh' });
  });

  it('drops invalid fields so the defaults apply', () => {
    expect(
      sanitizeReasoningConfig({
        type: 'turbo',
        budgetTokens: 'x',
        effort: 'ultra',
      })
    ).toEqual({});
    expect(
      sanitizeReasoningConfig({ type: 'enabled', budgetTokens: -1 })
    ).toEqual({ type: 'enabled' });
  });

  it('ignores values that are not objects', () => {
    expect(sanitizeReasoningConfig(undefined)).toEqual({});
    expect(sanitizeReasoningConfig('enabled')).toEqual({});
    expect(sanitizeReasoningConfig(null)).toEqual({});
  });
});

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
    // version lets a later schema change migrate old entries.
    useChatPreferences.getState().setModelId('model-b');
    useChatPreferences.getState().setReasoningConfig({
      type: 'enabled',
      budgetTokens: 8192,
    });
    const stored = JSON.parse(localStorage.getItem('chatPreferences')!);
    expect(stored.version).toBe(1);
    expect(stored.state).toEqual({
      modelId: 'model-b',
      reasoningConfig: { type: 'enabled', budgetTokens: 8192 },
    });
  });
});
