import React from 'react';
import ModalDialog from '../ModalDialog';
import Button from '../Button';
import { BaseProps } from '../../@types/common';
import Alert from '../Alert';
import { useTranslation } from 'react-i18next';

type Props = BaseProps & {
  isOpen: boolean;
  targetLabel: string;
  isShared?: boolean;
  onDelete: () => void;
  onClose: () => void;
};

const ModalDialogDeleteUseCase: React.FC<Props> = (props) => {
  const { t } = useTranslation();

  return (
    <ModalDialog
      isOpen={props.isOpen}
      title={t('useCaseBuilder.deleteUseCaseTitle')}
      onClose={() => {
        props.onClose();
      }}>
      <div className="flex flex-col gap-2">
        {props.isShared && (
          <Alert severity="warning" className="mb-2">
            {t('useCaseBuilder.deleteSharedWarning')}
          </Alert>
        )}
        <div>
          <strong>{props.targetLabel}</strong>
          {t('useCaseBuilder.deleteConfirmation')}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            outlined
            onClick={() => {
              props.onClose();
            }}>
            {t('useCaseBuilder.cancel')}
          </Button>
          <Button
            className="bg-red-600"
            onClick={() => {
              props.onDelete();
            }}>
            {t('useCaseBuilder.delete')}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
};

export default ModalDialogDeleteUseCase;
