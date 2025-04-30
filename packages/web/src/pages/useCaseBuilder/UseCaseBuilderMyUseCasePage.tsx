import React, { useMemo, useState } from 'react';
import { UseCaseAsOutput } from 'generative-ai-use-cases';
import ButtonIcon from '../../components/ButtonIcon';
import { PiNotePencil, PiTrash } from 'react-icons/pi';
import Button from '../../components/Button';
import { useNavigate } from 'react-router-dom';
import useMyUseCases from '../../hooks/useCaseBuilder/useMyUseCases';
import ModalDialogDeleteUseCase from '../../components/useCaseBuilder/ModalDialogDeleteUseCase';
import Skeleton from '../../components/Skeleton';
import ModalDialogShareUseCase from '../../components/useCaseBuilder/ModalDialogShareUseCase';
import ButtonFavorite from '../../components/useCaseBuilder/ButtonFavorite';
import ButtonShare from '../../components/useCaseBuilder/ButtonShare';
import ButtonUseCaseEdit from '../../components/useCaseBuilder/ButtonUseCaseEdit';
import Card from '../../components/Card';
import { useTranslation } from 'react-i18next';

const UseCaseBuilderMyUseCasePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    myUseCases,
    isLoadingMyUseCases,
    loadMoreMyUseCases,
    canLoadMoreMyUseCases,
    deleteUseCase,
    toggleFavorite,
    toggleShared,
  } = useMyUseCases();

  const [isOpenConfirmDelete, setIsOpenConfirmDelete] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [isOpenShareUseCase, setIsOpenShareUseCase] = useState(false);
  const [shareTargetId, setShareTargetId] = useState<string | null>(null);

  const deleteTargetUseCase = useMemo<UseCaseAsOutput | null>(() => {
    return deleteTargetId
      ? (myUseCases.find((uc) => uc.useCaseId === deleteTargetId) ?? null)
      : null;
  }, [deleteTargetId, myUseCases]);

  const shareTargetUseCase = useMemo<UseCaseAsOutput | null>(() => {
    return shareTargetId
      ? (myUseCases.find((uc) => uc.useCaseId === shareTargetId) ?? null)
      : null;
  }, [shareTargetId, myUseCases]);

  return (
    <>
      <ModalDialogDeleteUseCase
        isOpen={isOpenConfirmDelete}
        targetLabel={deleteTargetUseCase?.title ?? ''}
        isShared={deleteTargetUseCase?.isShared}
        onClose={() => {
          setIsOpenConfirmDelete(false);
        }}
        onDelete={() => {
          if (deleteTargetUseCase) {
            setIsOpenConfirmDelete(false);
            deleteUseCase(deleteTargetUseCase.useCaseId);
          }
        }}
      />
      <ModalDialogShareUseCase
        isOpen={isOpenShareUseCase}
        isShared={shareTargetUseCase?.isShared ?? false}
        useCaseId={shareTargetUseCase?.useCaseId ?? ''}
        onToggleShared={() => {
          toggleShared(shareTargetUseCase?.useCaseId ?? '');
        }}
        onClose={() => {
          setIsOpenShareUseCase(false);
        }}
      />

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-row">
          <div className="flex-1" />
          <div className="hidden flex-row items-center justify-center text-xl font-semibold lg:flex print:flex">
            {t('useCaseBuilder.myUseCases')}
          </div>
          <div className="flex flex-1 justify-end">
            <Button
              className=""
              onClick={() => {
                navigate(`/use-case-builder/new`);
              }}>
              <PiNotePencil className="mr-2" />
              {t('useCaseBuilder.createNew')}
            </Button>
          </div>
        </div>

        <Card>
          {!isLoadingMyUseCases && myUseCases.length === 0 && (
            <div className="flex h-full w-full items-center justify-center py-16 text-sm font-bold text-gray-400">
              {t('useCaseBuilder.noMyUseCases')}
            </div>
          )}
          {myUseCases.map((useCase, idx) => {
            return (
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
                <div className="flex items-center gap-2">
                  <ButtonFavorite
                    isFavorite={useCase.isFavorite}
                    onClick={() => {
                      toggleFavorite(useCase.useCaseId);
                    }}
                  />
                  <ButtonUseCaseEdit useCaseId={useCase.useCaseId} />
                  <ButtonIcon
                    onClick={() => {
                      setDeleteTargetId(useCase.useCaseId);
                      setIsOpenConfirmDelete(true);
                    }}>
                    <PiTrash />
                  </ButtonIcon>
                  <ButtonShare
                    isShared={useCase.isShared}
                    onClick={() => {
                      setShareTargetId(useCase.useCaseId);
                      setIsOpenShareUseCase(true);
                    }}
                  />
                </div>
              </div>
            );
          })}
          {isLoadingMyUseCases && (
            <div className="flex flex-col gap-2 p-2">
              {new Array(10).fill('').map((_, idx) => (
                <Skeleton key={idx} />
              ))}
            </div>
          )}

          {canLoadMoreMyUseCases && !isLoadingMyUseCases && (
            <div className="mt-2 flex w-full justify-center">
              <button
                className="text-sm hover:underline"
                onClick={loadMoreMyUseCases}>
                {t('useCaseBuilder.loadMore')}
              </button>
            </div>
          )}
        </Card>
      </div>
    </>
  );
};

export default UseCaseBuilderMyUseCasePage;
