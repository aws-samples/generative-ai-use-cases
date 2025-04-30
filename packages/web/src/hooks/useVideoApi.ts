import {
  VideoJob,
  GenerateVideoRequest,
  GenerateVideoResponse,
  ListVideoJobsResponse,
} from 'generative-ai-use-cases';
import useHttp from './useHttp';

const useVideoApi = () => {
  const http = useHttp();

  return {
    generateVideo: (params: GenerateVideoRequest) => {
      return http.post<GenerateVideoResponse>('/video/generate', params);
    },
    listVideoJobs: () => {
      const getKey = (
        pageIndex: number,
        previousPageData: ListVideoJobsResponse
      ) => {
        if (previousPageData && !previousPageData.lastEvaluatedKey) return null;
        if (pageIndex === 0) return 'video/generate';
        return `video/generate?exclusiveStartKey=${previousPageData.lastEvaluatedKey}`;
      };
      return http.getPagination<ListVideoJobsResponse>(getKey, {
        revalidateIfStale: false,
      });
    },
    deleteVideoJob: (videoJob: VideoJob) => {
      return http.delete(`/video/generate/${videoJob.createdDate}`);
    },
  };
};

export default useVideoApi;
