import React, { useMemo } from 'react';
import ModalDialog from '../ModalDialog';
import Button from '../Button';
import { BaseProps } from '../../@types/common';
import Switch from '../Switch';
import ButtonCopy from '../ButtonCopy';
import { useTranslation } from 'react-i18next';

type Props = BaseProps & {
  isOpen: boolean;
  isShared: boolean;
  useCaseId: string;
  onToggleShared: () => void;
  onClose: () => void;
};

const ModalDialogShareUseCase: React.FC<Props> = (props) => {
  const { t } = useTranslation();

  const shareUrl = useMemo(() => {
    return `${window.location.origin}/use-case-builder/execute/${props.useCaseId}`;
  }, [props.useCaseId]);

  return (
    <ModalDialog
      isOpen={props.isOpen}
      title={t('useCaseBuilder.share')}
      onClose={() => {
        props.onClose();
      }}>
      <div className="flex flex-col gap-2">
        <div>
          <Switch
            checked={props.isShared}
            className="text-xl"
            label={
              props.isShared
                ? t('useCaseBuilder.sharedDescription')
                : t('useCaseBuilder.notSharedDescription')
            }
            onSwitch={() => {
              props.onToggleShared();
            }}
          />
        </div>

        <div className="flex flex-col">
          {props.isShared && (
            <>
              <div className="flex grow ">
                <div className="bg-aws-squid-ink my-2 flex flex-row items-center justify-between rounded px-2 py-1 text-white">
                  <div className="break-all text-sm">{shareUrl}</div>
                  <ButtonCopy text={shareUrl} />
                </div>
              </div>
              <div className="text-xs text-gray-400">
                {t('useCaseBuilder.shareUrlDescription')}
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => {
              props.onClose();
            }}>
            {t('useCaseBuilder.ok')}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
};

export default ModalDialogShareUseCase;
