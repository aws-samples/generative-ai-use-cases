import { SWRInfiniteResponse } from 'swr/infinite';
import { Pagination } from 'generative-ai-use-cases';

const usePagination = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  swr: SWRInfiniteResponse<Pagination<any>>,
  pageSize: number
) => {
  const { data, size, setSize, error, mutate, isValidating } = swr;
  const flattenData = data
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.map((d: Pagination<any>) => d.data).flat()
    : [];
  const isLoadingInitialData = !data && !error;
  const isLoadingMore =
    isLoadingInitialData ||
    (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isEmpty = data?.[0]?.data?.length === 0;
  const isReachingEnd =
    isEmpty ||
    (data &&
      (data[data.length - 1]?.data.length < pageSize ||
        !data[data.length - 1]?.lastEvaluatedKey));
  const canLoadMore = !isReachingEnd;

  return {
    data,
    flattenData,
    mutate,
    isLoading: isLoadingMore,
    isReachingEnd,
    isValidating,
    canLoadMore,
    loadMore: () => {
      setSize(size + 1);
    },
  };
};

export default usePagination;
