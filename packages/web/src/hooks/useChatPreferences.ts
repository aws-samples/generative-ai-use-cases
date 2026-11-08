import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AdditionalModelRequestFields } from 'generative-ai-use-cases';

type ReasoningConfig = AdditionalModelRequestFields['reasoningConfig'];

/**
 * Chat settings remembered across reloads in this browser (localStorage).
 *
 * Only the user's own choices are kept: the last model picked in the chat use
 * case (#1391) and the reasoning settings changed in the UI (#923). Both are
 * re-checked when read: a redeploy can remove a model that an old entry still
 * names, and the stored reasoning values are validated.
 */
type ChatPreferencesState = {
  modelId?: string;
  reasoningConfig?: ReasoningConfig;
  setModelId: (modelId: string) => void;
  setReasoningConfig: (reasoningConfig: ReasoningConfig) => void;
};

const useChatPreferences = create<ChatPreferencesState>()(
  persist(
    (set) => ({
      modelId: undefined,
      reasoningConfig: undefined,
      setModelId: (modelId) => set({ modelId }),
      setReasoningConfig: (reasoningConfig) => set({ reasoningConfig }),
    }),
    {
      name: 'chatPreferences',
      version: 1,
      partialize: (state) => ({
        modelId: state.modelId,
        reasoningConfig: state.reasoningConfig,
      }),
    }
  )
);

const REASONING_TYPES = ['enabled', 'disabled', 'adaptive'] as const;
const EFFORTS = ['max', 'xhigh', 'high', 'medium', 'low'] as const;

/**
 * Keep only the valid fields of a stored reasoning config.
 *
 * localStorage can hold anything: an entry from an older version, or one
 * edited by hand. An invalid `budgetTokens` would otherwise be sent to
 * Bedrock as `budget_tokens` and fail the request, so each field is checked
 * and dropped if invalid; the caller fills in the defaults.
 */
export const sanitizeReasoningConfig = (
  saved: unknown
): Partial<NonNullable<ReasoningConfig>> => {
  if (typeof saved !== 'object' || saved === null) return {};
  const { type, budgetTokens, effort } = saved as Record<string, unknown>;
  return {
    ...(REASONING_TYPES.includes(type as (typeof REASONING_TYPES)[number])
      ? { type: type as (typeof REASONING_TYPES)[number] }
      : {}),
    ...(Number.isInteger(budgetTokens) && (budgetTokens as number) > 0
      ? { budgetTokens: budgetTokens as number }
      : {}),
    ...(EFFORTS.includes(effort as (typeof EFFORTS)[number])
      ? { effort: effort as (typeof EFFORTS)[number] }
      : {}),
  };
};

/**
 * The model to start a chat with: the remembered one if this deployment still
 * offers it, otherwise the deployment's default (the first available model).
 */
export const pickInitialModelId = (
  savedModelId: string | undefined,
  availableModelIds: string[]
): string | undefined =>
  savedModelId && availableModelIds.includes(savedModelId)
    ? savedModelId
    : availableModelIds[0];

export default useChatPreferences;
