import { GenerateVideoParams, Model } from 'generative-ai-use-cases';
import useVideoApi from './useVideoApi';
import usePagination from './usePagination';

const useVideo = () => {
  const {
    generateVideo,
    listVideoJobs,
    deleteVideoJob: deleteVideoJobApi,
  } = useVideoApi();
  const {
    flattenData: videoJobs,
    mutate: mutateVideoJobs,
    isLoading: isLoadingVideoJobs,
    canLoadMore: canLoadMoreVideoJobs,
    loadMore: loadMoreVideoJobs,
    isValidating: isValidatingVideoJobs,
  } = usePagination(listVideoJobs(), 10);

  return {
    generate: async (params: GenerateVideoParams, model: Model | undefined) => {
      return (
        await generateVideo({
          params,
          model,
        })
      ).data;
    },
    deleteVideoJob: deleteVideoJobApi,
    videoJobs,
    mutateVideoJobs,
    isLoadingVideoJobs,
    isValidatingVideoJobs,
    canLoadMoreVideoJobs,
    loadMoreVideoJobs,
  };
};

export default useVideo;
