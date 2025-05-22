import React, { useCallback, useMemo } from 'react';
import { BaseProps } from '../@types/common';
import { PiFileX, PiImageLight, PiDownload } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import ButtonIcon from '../components/ButtonIcon';

type Props = BaseProps & {
  imageBase64: string | null;
  loading?: boolean;
  clickable?: boolean;
  error?: boolean;
  errorMessage?: string;
  onClick?: () => void;
  downloadFileName?: string;
};

const Base64Image: React.FC<Props> = (props) => {
  const { t } = useTranslation();

  const onClick = useCallback(() => {
    if (props.clickable) {
      props.onClick ? props.onClick() : null;
    }
  }, [props]);

  const src = useMemo(() => {
    return props.imageBase64?.startsWith('data')
      ? props.imageBase64
      : `data:image/png;base64,${props.imageBase64}`;
  }, [props.imageBase64]);

  const extension = useMemo(() => {
    return src.split('data:image/')[1]?.split(';')[0] ?? 'png';
  }, [src]);

  const download = useCallback(() => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `${props.downloadFileName}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [src, props.downloadFileName, extension]);

  return (
    <div
      className={`${
        props.className ?? ''
      } flex items-center justify-center rounded border border-black/30 ${
        props.clickable ? 'cursor-pointer hover:brightness-50' : ''
      } relative`}
      onClick={onClick}>
      {props.error ? (
        <div className="flex w-full flex-col items-center">
          <PiFileX
            className={`${
              props.errorMessage ? 'size-1/4' : 'size-3/4'
            } text-red-500`}
          />
          <div className="text-sm text-red-500">{t('common.error')}</div>

          {props.errorMessage && (
            <div className="w-full break-words text-sm text-gray-400">
              {props.errorMessage}
            </div>
          )}
        </div>
      ) : !props.imageBase64 || props.imageBase64 === '' ? (
        <>
          {props.loading ? (
            <div className="border-aws-sky size-6 animate-spin rounded-full border-4 border-t-transparent"></div>
          ) : (
            <PiImageLight className="size-3/4 text-gray-300" />
          )}
        </>
      ) : (
        <>
          <img src={src} className="size-full" />
          {props.downloadFileName && (
            <ButtonIcon
              className="absolute bottom-5 right-5 bg-white p-2"
              onClick={download}>
              <PiDownload />
            </ButtonIcon>
          )}
        </>
      )}
    </div>
  );
};

export default Base64Image;
