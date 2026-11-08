import {
  AdditionalModelRequestFields,
  FeatureFlags,
} from 'generative-ai-use-cases';
import RangeSlider from './RangeSlider';
import { useTranslation } from 'react-i18next';
import { EFFORT_OPTIONS } from '../utils/reasoningEffort';

const MIN_REASONING_BUDGET = 1024; // Claude 3.7 Sonnet minimum value
const MAX_REASONING_BUDGET = 32768; // Temporary value
const REASONING_BUDGET_STEP = 1024;

export const ModelParameters: React.FC<{
  modelFeatureFlags: FeatureFlags;
  overrideModelParameters: AdditionalModelRequestFields;
  setOverrideModelParameters: (
    overrideModelParameters: AdditionalModelRequestFields
  ) => void;
}> = ({
  modelFeatureFlags,
  overrideModelParameters,
  setOverrideModelParameters,
}) => {
  const { t } = useTranslation();

  const handleReasoningBudgetChange = (value: number) => {
    setOverrideModelParameters({
      ...overrideModelParameters,
      reasoningConfig: {
        ...overrideModelParameters.reasoningConfig,
        budgetTokens: value,
      },
    });
  };

  const handleEffortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOverrideModelParameters({
      ...overrideModelParameters,
      reasoningConfig: {
        ...overrideModelParameters.reasoningConfig,
        effort: e.target.value as 'max' | 'xhigh' | 'high' | 'medium' | 'low',
      },
    });
  };

  const effortOptions = EFFORT_OPTIONS.filter(
    (option) => option.value !== 'xhigh' || modelFeatureFlags.xhighEffort
  );

  const effort = overrideModelParameters.reasoningConfig.effort ?? 'high';
  const effortValue =
    effort === 'xhigh' && !modelFeatureFlags.xhighEffort ? 'high' : effort;

  if (!modelFeatureFlags.reasoning) {
    return null;
  }

  return (
    <div>
      {modelFeatureFlags.adaptiveThinking ? (
        <div>
          <div className="mb-2">{t('model.parameters.reasoning_effort')}</div>
          <select
            className="w-full rounded border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-800"
            value={effortValue}
            onChange={handleEffortChange}>
            {effortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <div className="mb-2">{t('model.parameters.reasoning_budget')}</div>
          <div>
            <RangeSlider
              min={MIN_REASONING_BUDGET}
              max={MAX_REASONING_BUDGET}
              step={REASONING_BUDGET_STEP}
              value={overrideModelParameters.reasoningConfig.budgetTokens}
              onChange={handleReasoningBudgetChange}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelParameters;
