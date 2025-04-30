import useUseCaseBuilderApi from './useUseCaseBuilderApi';
import { UseCaseInputExample } from 'generative-ai-use-cases';
import usePagination from '../usePagination';
import { produce } from 'immer';
import { Pagination } from 'generative-ai-use-cases';

const useMyUseCases = () => {
  const {
    listMyUseCases,
    listFavoriteUseCases,
    listRecentlyUsedUseCases,
    createUseCase,
    updateUseCase,
    updateRecentUseUseCase,
    deleteUseCase,
    toggleFavorite,
    toggleShared,
  } = useUseCaseBuilderApi();

  const {
    data: myUseCasesRaw,
    flattenData: myUseCases,
    mutate: mutateMyUseCases,
    isLoading: isLoadingMyUseCases,
    loadMore: loadMoreMyUseCases,
    canLoadMore: canLoadMoreMyUseCases,
  } = usePagination(listMyUseCases(), 30);

  const {
    data: favoriteUseCasesRaw,
    flattenData: favoriteUseCases,
    mutate: mutateFavoriteUseCases,
    isLoading: isLoadingFavoriteUseCases,
    loadMore: loadMoreFavoriteUseCases,
    canLoadMore: canLoadMoreFavoriteUseCases,
  } = usePagination(listFavoriteUseCases(), 20);

  const {
    data: recentlyUsedUseCasesRaw,
    flattenData: recentlyUsedUseCases,
    mutate: mutateRecentlyUsedUseCases,
    isLoading: isLoadingRecentlyUsedUseCases,
    loadMore: loadMoreRecentlyUsedUseCases,
    canLoadMore: canLoadMoreRecentlyUsedUseCases,
  } = usePagination(listRecentlyUsedUseCases(), 20);

  const findIndex = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useCasesRaw: Pagination<any>[] | undefined,
    useCaseId: string
  ): { page: number; idx: number } => {
    if (!useCasesRaw) {
      return { page: -1, idx: -1 };
    }

    for (const [pageIndex, useCases] of useCasesRaw.entries()) {
      const idx: number =
        useCases.data.findIndex((u) => u.useCaseId === useCaseId) ?? -1;

      if (idx >= 0) {
        return {
          page: pageIndex as number,
          idx,
        };
      }
    }

    // If there is no corresponding item, return -1
    return { page: -1, idx: -1 };
  };

  return {
    myUseCases,
    isLoadingMyUseCases,
    loadMoreMyUseCases,
    canLoadMoreMyUseCases,

    favoriteUseCases: favoriteUseCases ?? [],
    isLoadingFavoriteUseCases,
    loadMoreFavoriteUseCases,
    canLoadMoreFavoriteUseCases,

    recentlyUsedUseCases: recentlyUsedUseCases ?? [],
    isLoadingRecentlyUsedUseCases,
    loadMoreRecentlyUsedUseCases,
    canLoadMoreRecentlyUsedUseCases,

    createUseCase: (params: {
      title: string;
      promptTemplate: string;
      description?: string;
      inputExamples?: UseCaseInputExample[];
      fixedModelId?: string;
      fileUpload?: boolean;
    }) => {
      return createUseCase(params).finally(() => {
        mutateMyUseCases();
      });
    },
    updateUseCase: (params: {
      useCaseId: string;
      title: string;
      promptTemplate: string;
      description?: string;
      inputExamples?: UseCaseInputExample[];
      fixedModelId?: string;
      fileUpload?: boolean;
    }) => {
      // Only do optimistic processing for items that are affected by the update
      const { page: pageFavorite, idx: idxFavorite } = findIndex(
        favoriteUseCasesRaw,
        params.useCaseId
      );
      if (pageFavorite >= 0 && idxFavorite >= 0) {
        mutateFavoriteUseCases(
          produce(favoriteUseCasesRaw, (draft) => {
            draft![pageFavorite].data[idxFavorite].title = params.title;
          }),
          {
            revalidate: false,
          }
        );
      }

      const { page: pageRecentlyUsed, idx: idxRecentlyUsed } = findIndex(
        recentlyUsedUseCasesRaw,
        params.useCaseId
      );
      if (pageRecentlyUsed >= 0 && idxRecentlyUsed >= 0) {
        mutateRecentlyUsedUseCases(
          produce(recentlyUsedUseCasesRaw, (draft) => {
            draft![pageRecentlyUsed].data[idxRecentlyUsed].title = params.title;
          }),
          {
            revalidate: false,
          }
        );
      }

      return updateUseCase(params.useCaseId, {
        title: params.title,
        promptTemplate: params.promptTemplate,
        description: params.description,
        inputExamples: params.inputExamples,
        fixedModelId: params.fixedModelId,
        fileUpload: params.fileUpload,
      }).finally(() => {
        mutateMyUseCases();
        mutateFavoriteUseCases();
        mutateRecentlyUsedUseCases();
      });
    },
    updateRecentUseUseCase: (useCaseId: string) => {
      return updateRecentUseUseCase(useCaseId).finally(() => {
        mutateRecentlyUsedUseCases();
      });
    },
    deleteUseCase: (useCaseId: string) => {
      const { page: pageMy, idx: idxMy } = findIndex(myUseCasesRaw, useCaseId);
      if (pageMy >= 0 && idxMy >= 0) {
        mutateMyUseCases(
          produce(myUseCasesRaw, (draft) => {
            draft![pageMy].data.splice(idxMy, 1);
          }),
          {
            revalidate: false,
          }
        );
      }

      const { page: pageFavorite, idx: idxFavorite } = findIndex(
        favoriteUseCasesRaw,
        useCaseId
      );
      if (pageFavorite >= 0 && idxFavorite >= 0) {
        mutateFavoriteUseCases(
          produce(favoriteUseCasesRaw, (draft) => {
            draft![pageFavorite].data.splice(idxFavorite, 1);
          }),
          {
            revalidate: false,
          }
        );
      }

      const { page: pageRecentlyUsed, idx: idxRecentlyUsed } = findIndex(
        recentlyUsedUseCasesRaw,
        useCaseId
      );
      if (pageRecentlyUsed >= 0 && idxRecentlyUsed >= 0) {
        mutateRecentlyUsedUseCases(
          produce(recentlyUsedUseCasesRaw, (draft) => {
            draft![pageRecentlyUsed].data.splice(idxRecentlyUsed, 1);
          }),
          {
            revalidate: false,
          }
        );
      }

      return deleteUseCase(useCaseId).finally(() => {
        mutateMyUseCases();
        mutateFavoriteUseCases();
        mutateRecentlyUsedUseCases();
      });
    },
    toggleFavorite: (useCaseId: string) => {
      // Only do optimistic processing for items that are affected by the update
      const { page: pageMy, idx: idxMy } = findIndex(myUseCasesRaw, useCaseId);
      if (pageMy >= 0 && idxMy >= 0) {
        mutateMyUseCases(
          produce(myUseCasesRaw, (draft) => {
            draft![pageMy].data[idxMy].isFavorite =
              !draft![pageMy].data[idxMy].isFavorite;
          }),
          {
            revalidate: false,
          }
        );
      }

      // The display and addition to the favorite list are complex, so do not do optimistic processing

      return toggleFavorite(useCaseId).finally(() => {
        mutateMyUseCases();
        mutateFavoriteUseCases();
        mutateRecentlyUsedUseCases();
      });
    },
    toggleShared: (useCaseId: string) => {
      // Only do optimistic processing for items that are affected by the update
      const { page: pageMy, idx: idxMy } = findIndex(myUseCasesRaw, useCaseId);
      if (pageMy >= 0 && idxMy >= 0) {
        mutateMyUseCases(
          produce(myUseCasesRaw, (draft) => {
            draft![pageMy].data[idxMy].isShared =
              !draft![pageMy].data[idxMy].isShared;
          }),
          {
            revalidate: false,
          }
        );
      }

      return toggleShared(useCaseId).finally(() => {
        mutateMyUseCases();
        mutateRecentlyUsedUseCases();
      });
    },
  };
};

export default useMyUseCases;
