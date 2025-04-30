import React from 'react';
import ModalDialog from './ModalDialog';
import { BaseProps } from '../@types/common';
import Textarea from './Textarea';
import Button from './Button';
import { useTranslation } from 'react-i18next';

type Props = BaseProps & {
  showSystemContextModal: boolean;
  saveSystemContext: string;
  saveSystemContextTitle: string;
  setShowSystemContextModal: (show: boolean) => void;
  setSaveSystemContext: (systemContext: string) => void;
  setSaveSystemContextTitle: (title: string) => void;
  onCreateSystemContext: () => void;
};

const ModalSystemContext: React.FC<Props> = (props) => {
  const { t } = useTranslation();

  return (
    <>
      <ModalDialog
        title={t('chat.create_system_prompt')}
        isOpen={props.showSystemContextModal}
        onClose={() => {
          props.setShowSystemContextModal(false);
        }}>
        <div className="py-2.5">{t('common.title')}</div>

        <Textarea
          placeholder={t('common.enter_text')}
          value={props.saveSystemContextTitle}
          onChange={props.setSaveSystemContextTitle}
          maxHeight={-1}
          className="text-aws-font-color"
        />

        <div className="py-2.5">{t('chat.system_prompt')}</div>
        <Textarea
          placeholder={t('common.enter_text')}
          value={props.saveSystemContext}
          onChange={props.setSaveSystemContext}
          maxHeight={500}
          className="text-aws-font-color"
        />

        <div className="mt-4 flex justify-end gap-2">
          <Button
            outlined
            onClick={() => props.setShowSystemContextModal(false)}
            className="p-2">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              props.setShowSystemContextModal(false);
              props.onCreateSystemContext();
            }}
            className="bg-red-500 p-2 text-white"
            disabled={
              props.saveSystemContext === '' ||
              props.saveSystemContextTitle === ''
            }>
            {t('common.create')}
          </Button>
        </div>
      </ModalDialog>
    </>
  );
};

export default ModalSystemContext;
