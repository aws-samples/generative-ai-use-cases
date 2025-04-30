import React from 'react';
import { BaseProps } from '../@types/common';
import Button from './Button';
import ModalDialog from './ModalDialog';
import { Chat } from 'generative-ai-use-cases';
import { decomposeId } from '../utils/ChatUtils';
import { useTranslation } from 'react-i18next';

type Props = BaseProps & {
  isOpen: boolean;
  target?: Chat;
  onDelete: (chatId: string) => void;
  onClose: () => void;
};

const DialogConfirmDeleteChat: React.FC<Props> = (props) => {
  const { t } = useTranslation();

  return (
    <ModalDialog {...props} title={t('chat.delete_confirmation')}>
      <div>
        {t('chat.delete_chat_confirmation', { title: props.target?.title })}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button outlined onClick={props.onClose} className="p-2">
          {t('common.cancel')}
        </Button>
        <Button
          onClick={() => {
            props.onDelete(decomposeId(props.target?.chatId ?? '') ?? '');
          }}
          className="bg-red-500 p-2 text-white">
          {t('common.delete')}
        </Button>
      </div>
    </ModalDialog>
  );
};

export default DialogConfirmDeleteChat;
