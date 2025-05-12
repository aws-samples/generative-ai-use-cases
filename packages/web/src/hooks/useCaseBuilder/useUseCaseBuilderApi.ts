import {
  CreateUseCaseRequest,
  CreateUseCaseResponse,
  GetUseCaseResponse,
  ListFavoriteUseCasesResponse,
  ListRecentlyUsedUseCasesResponse,
  ListUseCasesResponse,
  ToggleFavoriteResponse,
  ToggleShareResponse,
  UpdateUseCaseRequest,
} from 'generative-ai-use-cases';
import useHttp from '../useHttp';
import { AxiosError } from 'axios';

const useUseCaseBuilderApi = () => {
  const http = useHttp();

  return {
    listMyUseCases: () => {
      const getKey = (
        pageIndex: number,
        previousPageData: ListUseCasesResponse
      ) => {
        if (previousPageData && !previousPageData.lastEvaluatedKey) return null;
        if (pageIndex === 0) return '/usecases';
        return `usecases?exclusiveStartKey=${previousPageData.lastEvaluatedKey}`;
      };
      return http.getPagination<ListUseCasesResponse>(getKey, {
        revalidateIfStale: false,
      });
    },
    listFavoriteUseCases: () => {
      const getKey = (
        pageIndex: number,
        previousPageData: ListFavoriteUseCasesResponse
      ) => {
        if (previousPageData && !previousPageData.lastEvaluatedKey) return null;
        if (pageIndex === 0) return '/usecases/favorite';
        return `usecases/favorite?exclusiveStartKey=${previousPageData.lastEvaluatedKey}`;
      };
      return http.getPagination<ListFavoriteUseCasesResponse>(getKey, {
        revalidateIfStale: false,
      });
    },
    listRecentlyUsedUseCases: () => {
      const getKey = (
        pageIndex: number,
        previousPageData: ListRecentlyUsedUseCasesResponse
      ) => {
        if (previousPageData && !previousPageData.lastEvaluatedKey) return null;
        if (pageIndex === 0) return '/usecases/recent';
        return `usecases/recent?exclusiveStartKey=${previousPageData.lastEvaluatedKey}`;
      };
      return http.getPagination<ListRecentlyUsedUseCasesResponse>(getKey, {
        revalidateIfStale: false,
      });
    },
    getUseCase: (useCaseId?: string) => {
      return http.get<GetUseCaseResponse, AxiosError>(
        useCaseId ? `/usecases/${useCaseId}` : null
      );
    },
    createUseCase: async (params: CreateUseCaseRequest) => {
      return http
        .post<CreateUseCaseResponse, CreateUseCaseRequest>('/usecases', params)
        .then((res) => {
          return res.data;
        });
    },
    updateUseCase: async (useCaseId: string, params: UpdateUseCaseRequest) => {
      return http.put<null, UpdateUseCaseRequest>(
        `/usecases/${useCaseId}`,
        params
      );
    },
    updateRecentUseUseCase: async (useCaseId: string) => {
      return http.put<null>(`/usecases/recent/${useCaseId}`, {});
    },
    deleteUseCase: async (useCaseId: string) => {
      return http.delete(`/usecases/${useCaseId}`);
    },
    toggleFavorite: async (useCaseId: string) => {
      return http.put<ToggleFavoriteResponse>(
        `/usecases/${useCaseId}/favorite`,
        {}
      );
    },
    toggleShared: async (useCaseId: string) => {
      return http.put<ToggleShareResponse>(`/usecases/${useCaseId}/shared`, {});
    },
  };
};

export default useUseCaseBuilderApi;
