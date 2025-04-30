import {
  AdditionalModelRequestFields,
  FeatureFlags,
} from 'generative-ai-use-cases';
import Switch from './Switch';
import RangeSlider from './RangeSlider';
import { useTranslation } from 'react-i18next';

const DEFAULT_REASONING_BUDGET = 4096; // Claude 3.7 Sonnet recommended minimum value
const MIN_REASONING_BUDGET = 1024; // Claude 3.7 Sonnet minimum value
const MAX_REASONING_BUDGET = 32768; // Temporary value
const REASONING_BUDGET_STEP = 1024;

export const ModelParameters: React.FC<{
  modelFeatureFlags: FeatureFlags;
  overrideModelParameters: AdditionalModelRequestFields | undefined;
  setOverrideModelParameters: (
    overrideModelParameters: AdditionalModelRequestFields | undefined
  ) => void;
}> = ({
  modelFeatureFlags,
  overrideModelParameters,
  setOverrideModelParameters,
}) => {
  const { t } = useTranslation();

  const handleReasoningSwitch = (newValue: boolean) => {
    setOverrideModelParameters({
      ...overrideModelParameters,
      reasoningConfig: newValue
        ? {
            type: 'enabled',
            budgetTokens:
              overrideModelParameters?.reasoningConfig?.budgetTokens ||
              DEFAULT_REASONING_BUDGET,
          }
        : { type: 'disabled' },
    });
  };

  const handleReasoningBudgetChange = (value: number) => {
    setOverrideModelParameters({
      ...overrideModelParameters,
      reasoningConfig: {
        type: 'enabled',
        budgetTokens: value || DEFAULT_REASONING_BUDGET,
      },
    });
  };

  const isReasoningEnabled =
    overrideModelParameters?.reasoningConfig?.type === 'enabled';

  if (!modelFeatureFlags.reasoning) {
    return null;
  }

  return (
    <div>
      {modelFeatureFlags.reasoning && (
        <div>
          <div>
            <div>{t('model.parameters.reasoning')}</div>
            <div>
              <Switch
                label=""
                checked={isReasoningEnabled}
                onSwitch={handleReasoningSwitch}
              />
            </div>
          </div>
          {overrideModelParameters?.reasoningConfig?.type === 'enabled' && (
            <div>
              <div>{t('model.parameters.reasoning_budget')}</div>
              <div>
                <RangeSlider
                  min={MIN_REASONING_BUDGET}
                  max={MAX_REASONING_BUDGET}
                  step={REASONING_BUDGET_STEP}
                  value={
                    overrideModelParameters?.reasoningConfig?.budgetTokens ||
                    DEFAULT_REASONING_BUDGET
                  }
                  onChange={handleReasoningBudgetChange}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelParameters;
