import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useUseCaseBuilderApi from '../../hooks/useCaseBuilder/useUseCaseBuilderApi';
import useMyUseCases from '../../hooks/useCaseBuilder/useMyUseCases';
import usePagination from '../../hooks/usePagination';
import ButtonFavorite from '../../components/useCaseBuilder/ButtonFavorite';
import Card from '../../components/Card';
import Skeleton from '../../components/Skeleton';

// Use cases that anyone has shared (public), so others can find them
// without a link
const UseCaseBuilderPublicUseCasePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { listPublicUseCases } = useUseCaseBuilderApi();
  const {
    flattenData: publicUseCases,
    mutate,
    isLoading,
    loadMore,
    canLoadMore,
  } = usePagination(listPublicUseCases(), 30);
  const { toggleFavorite } = useMyUseCases();

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="hidden flex-row items-center justify-center text-xl font-semibold lg:flex print:flex">
        {t('useCaseBuilder.publicUseCases')}
      </div>
      <p className="text-center text-sm text-gray-600">
        {t('useCaseBuilder.publicUseCasesDescription')}
      </p>

      <Card>
        {!isLoading && publicUseCases.length === 0 && (
          <div className="flex h-full w-full items-center justify-center py-16 text-sm font-bold text-gray-400">
            {t('useCaseBuilder.noPublicUseCases')}
          </div>
        )}
        {publicUseCases.map((useCase, idx) => (
          <div
            key={useCase.useCaseId}
            className={`flex flex-row items-center gap-x-2 p-2 hover:bg-gray-100 ${idx > 0 ? 'border-t' : ''}`}>
            <div
              className="flex flex-1 cursor-pointer flex-col justify-start"
              onClick={() => {
                navigate(`/use-case-builder/execute/${useCase.useCaseId}`);
              }}>
              <div className="line-clamp-1 text-sm font-bold">
                {useCase.title}
              </div>
              <div className="line-clamp-1 text-xs font-light text-gray-400">
                {useCase.description}
              </div>
            </div>
            <ButtonFavorite
              isFavorite={useCase.isFavorite}
              onClick={() => {
                toggleFavorite(useCase.useCaseId).finally(() => mutate());
              }}
            />
          </div>
        ))}
        {isLoading && (
          <div className="flex flex-col gap-2 p-2">
            {new Array(10).fill('').map((_, idx) => (
              <Skeleton key={idx} />
            ))}
          </div>
        )}

        {canLoadMore && !isLoading && (
          <div className="mt-2 flex w-full justify-center">
            <button className="text-sm hover:underline" onClick={loadMore}>
              {t('useCaseBuilder.loadMore')}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default UseCaseBuilderPublicUseCasePage;
