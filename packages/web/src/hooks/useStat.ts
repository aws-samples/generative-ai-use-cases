import { create } from 'zustand';
import { TokenUsageStats } from 'generative-ai-use-cases';

interface StatState {
  isLoading: boolean;
  error: Error | null;
  stats: TokenUsageStats[];
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  setStats: (stats: TokenUsageStats[]) => void;
}

const useStatStore = create<StatState>((set) => ({
  isLoading: false,
  error: null,
  stats: [],
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setStats: (stats) => set({ stats }),
}));

/**
 * Hook for getting token usage statistics
 */
const useStat = () => {
  const { isLoading, error, stats, setLoading, setError, setStats } =
    useStatStore();

  return {
    isLoading,
    error,
    stats,
    setLoading,
    setError,
    setStats,
  };
};

export default useStat;
