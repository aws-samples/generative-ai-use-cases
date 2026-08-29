import React from 'react';
import { BaseProps } from '../@types/common';
import Button from './Button';
import ModalDialog from './ModalDialog';
import { useTranslation } from 'react-i18next';

type Props = BaseProps & {
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

const DialogConfirmEditMessage: React.FC<Props> = (props) => {
  const { t } = useTranslation();

  return (
    <ModalDialog {...props} title={t('chat.edit_message_confirmation')}>
      <div>{t('chat.edit_message_warning')}</div>

      <div className="mt-4 flex justify-end gap-2">
        <Button outlined onClick={props.onClose} className="p-2">
          {t('common.cancel')}
        </Button>
        <Button onClick={props.onConfirm} className="bg-red-500 p-2 text-white">
          {t('common.edit')}
        </Button>
      </div>
    </ModalDialog>
  );
};

export default DialogConfirmEditMessage;
