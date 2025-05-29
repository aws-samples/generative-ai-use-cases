import { useCallback, useMemo } from 'react';
import { create } from 'zustand';

type StateType = {
  onMemoryState: Record<string, string>;
  setValue: (key: string, value: string) => void;
};

const useLocalStorageState = create<StateType>((set) => {
  const setValue = (key: string, value: string) => {
    localStorage.setItem(key, value);
    set((state) => {
      return {
        onMemoryState: {
          ...state.onMemoryState,
          [key]: value,
        },
      };
    });
  };

  return {
    onMemoryState: {},
    setValue,
  };
});

const useLocalStorage = (key: string, defaultValue: string) => {
  const { setValue, onMemoryState } = useLocalStorageState();

  const setValueForKey = useCallback(
    (value: string) => {
      setValue(key, value);
    },
    [setValue, key]
  );

  const valueForKey = useMemo(() => {
    return onMemoryState[key] ?? localStorage.getItem(key) ?? defaultValue;
  }, [onMemoryState, key, defaultValue]);

  return [valueForKey, setValueForKey] as const;
};

export default useLocalStorage;
