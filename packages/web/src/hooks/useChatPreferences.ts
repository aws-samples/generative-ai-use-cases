import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AdditionalModelRequestFields } from 'generative-ai-use-cases';

type ReasoningConfig = AdditionalModelRequestFields['reasoningConfig'];

/**
 * Chat settings remembered across reloads in this browser (localStorage).
 *
 * Only the user's own choices are kept: the last model picked in the chat use
 * case (#1391) and the reasoning settings (#923). Both are re-checked when
 * read, because a redeploy can remove a model that an old entry still names.
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
      partialize: (state) => ({
        modelId: state.modelId,
        reasoningConfig: state.reasoningConfig,
      }),
    }
  )
);

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
