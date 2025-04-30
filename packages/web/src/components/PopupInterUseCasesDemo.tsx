import React, { useState } from 'react';
import { BaseProps } from '../@types/common';
import {
  PiCaretDown,
  PiX,
  PiCircleFill,
  PiCheckCircleFill,
  PiArrowFatLineLeftLight,
  PiArrowFatLineRightLight,
} from 'react-icons/pi';
import ButtonIcon from './ButtonIcon';
import useInterUseCases from '../hooks/useInterUseCases';
import { useTranslation } from 'react-i18next';

type Props = BaseProps;

const PopupInterUseCasesDemo: React.FC<Props> = () => {
  const { t } = useTranslation();
  const {
    setIsShow,
    title,
    useCases,
    currentIndex,
    setCurrentIndex,
    navigateUseCase,
  } = useInterUseCases();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="text-aws-squid-ink bg-white shadow-xl">
      <div
        className="flex cursor-pointer items-center justify-between py-2 pl-2 pr-1 text-sm"
        onClick={() => {
          setIsOpen(!isOpen);
        }}>
        <PiCaretDown
          className={`transition ${!isOpen && 'rotate-180'} mr-2 text-lg`}
        />
        <div className="text-lg font-bold">
          {title || t('demo.inter_use_cases')}
        </div>
        <ButtonIcon
          onClick={() => {
            setIsShow(false);
          }}>
          <PiX />
        </ButtonIcon>
      </div>

      <div
        className={`${
          isOpen ? '' : 'h-0 scale-y-0'
        } origin-top transition-all duration-100`}>
        <div className="flex h-80 flex-col items-center justify-between bg-white px-10 pb-10 pt-4 lg:h-fit lg:flex-row lg:px-24">
          {useCases.map((usecase, idx) => (
            <React.Fragment key={idx}>
              <div className="relative">
                {idx < currentIndex && (
                  <PiCheckCircleFill
                    className="text-aws-smile z-10 cursor-pointer bg-white text-2xl transition-all duration-100 hover:scale-125"
                    onClick={() => {
                      setCurrentIndex(idx);
                      navigateUseCase(idx);
                    }}
                  />
                )}
                {idx == currentIndex && (
                  <PiCircleFill
                    className="text-aws-smile z-10 cursor-pointer bg-white text-2xl transition-all duration-100 hover:scale-125"
                    onClick={() => {
                      setCurrentIndex(idx);
                      navigateUseCase(idx);
                    }}
                  />
                )}
                {idx > currentIndex && (
                  <PiCircleFill
                    className="z-10 cursor-pointer bg-white text-xl text-gray-300 transition-all duration-100 hover:scale-125"
                    onClick={() => {
                      setCurrentIndex(idx);
                      navigateUseCase(idx);
                    }}
                  />
                )}
                <div className="absolute left-1/2 top-6 w-max -translate-x-1/2 bg-white text-sm">
                  {usecase.title}
                </div>
              </div>
              {idx < currentIndex && idx < useCases.length - 1 && (
                <div className="border-aws-smile grow border-l-4 lg:border-t-4" />
              )}
              {idx >= currentIndex && idx < useCases.length - 1 && (
                <div className="grow border-l border-t border-gray-300" />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="flex w-full items-center justify-between bg-white px-10 pb-5 lg:px-24">
          <ButtonIcon
            className="hidden lg:flex"
            disabled={currentIndex <= 0}
            onClick={() => {
              setCurrentIndex(currentIndex - 1);
              navigateUseCase(currentIndex - 1);
            }}>
            <PiArrowFatLineLeftLight />
            <span className="text-sm">{t('common.previous')}</span>
          </ButtonIcon>
          <div className="mx-5 mt-1 flex grow flex-col justify-center border border-gray-500 p-4 text-xs">
            {useCases[currentIndex].description}
          </div>
          <ButtonIcon
            className="hidden lg:flex"
            disabled={currentIndex >= useCases.length - 1}
            onClick={() => {
              setCurrentIndex(currentIndex + 1);
              navigateUseCase(currentIndex + 1);
            }}>
            <span className="text-sm">{t('common.next')}</span>
            <PiArrowFatLineRightLight />
          </ButtonIcon>
        </div>
      </div>
    </div>
  );
};

export default PopupInterUseCasesDemo;
