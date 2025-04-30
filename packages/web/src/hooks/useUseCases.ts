import { HiddenUseCases, HiddenUseCasesKeys } from 'generative-ai-use-cases';

const hiddenUseCases: HiddenUseCases = JSON.parse(
  import.meta.env.VITE_APP_HIDDEN_USE_CASES
);

const useUseCases = () => {
  const enabledSingle = (useCase: HiddenUseCasesKeys): boolean => {
    return !hiddenUseCases[useCase];
  };

  const enabled = (...useCases: HiddenUseCasesKeys[]): boolean => {
    return useCases.every(enabledSingle);
  };

  return {
    enabled,
  };
};

export default useUseCases;
