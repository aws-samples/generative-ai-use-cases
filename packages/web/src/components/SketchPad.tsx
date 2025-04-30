import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ColorChangeHandler, CompactPicker } from 'react-color';
import {
  PiArrowClockwise,
  PiArrowCounterClockwise,
  PiDotBold,
  PiEraserFill,
  PiPaintBrushFill,
  PiPaintBucketFill,
  PiTrash,
  PiUploadSimple,
} from 'react-icons/pi';
import SignatureCanvas from 'react-signature-canvas';
import Button from './Button';
import { BaseProps } from '../@types/common';
import ModalDialog from './ModalDialog';
import RangeSlider from './RangeSlider';
import { useTranslation } from 'react-i18next';

type SketchButtonProps = BaseProps & {
  isActive?: boolean;
  onClick: () => void;
  children: ReactNode;
};

const SketchButton: React.FC<SketchButtonProps> = (props) => {
  return (
    <div
      className={`${
        props.className ?? ''
      } flex size-6 cursor-pointer items-center justify-center border ${
        props.isActive ? 'border-black/50 bg-gray-200' : ''
      }`}
      onClick={props.onClick}>
      {props.children}
    </div>
  );
};

export type Canvas = {
  imageBase64: string;
  foregroundBase64: string;
  backgroundColor: string;
};

type Props = {
  width: number;
  height: number;
  image?: Canvas;
  background?: Canvas;
  maskMode?: boolean;
  onChange: (image: Canvas) => void;
  onCancel: () => void;
};

const SketchPad: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const canvasRef = useRef<SignatureCanvas>(null);
  const [penColor, setPenColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [dotSize, setDotSize] = useState(3);
  const [isEraseMode, setIsEraseMode] = useState(false);
  const [isOpenPalette, setIsOpenPalette] = useState(false);
  const [isOpenPaletteBg, setIsOpenPaletteBg] = useState(false);
  const [isOpendotSizeSlider, setIsOpendotSizeSlider] = useState(false);

  const [isOpenUpload, setIsOpenUpload] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const undoStack: SignaturePad.Point[][] = [];

  useEffect(() => {
    if (props.image?.imageBase64) {
      canvasRef.current?.fromDataURL(props.image.foregroundBase64, {
        height: props.height,
        width: props.width,
      });
      setBgColor(props.image.backgroundColor);
    }
  }, [props.image, props.height, props.width]);

  const onChangePenColor = useCallback<ColorChangeHandler>((color) => {
    setIsOpenPalette(false);
    setPenColor(color.hex);
  }, []);

  const onChangeBgColor = useCallback<ColorChangeHandler>((color) => {
    setIsOpenPaletteBg(false);
    setBgColor(color.hex);
  }, []);

  const onClickUndo = useCallback(() => {
    const data = canvasRef.current?.toData();
    if (data) {
      const undoItem = data.pop();
      if (undoItem) {
        undoStack.push(undoItem);
      }
      canvasRef.current?.fromData(data);
    }
  }, [undoStack]);

  const onClickRedo = useCallback(() => {
    const data = canvasRef.current?.toData();
    if (data) {
      const redoItem = undoStack.pop();
      if (redoItem) {
        data.push(redoItem);
        canvasRef.current?.fromData(data);
      }
    }
  }, [undoStack]);

  const onClickComplete = useCallback(() => {
    if (canvasRef.current?.isEmpty()) {
      props.onChange({
        imageBase64: '',
        foregroundBase64: '',
        backgroundColor: '#ffffff',
      });
      return;
    }

    // To set the background color, create a new canvas and combine it
    const canvas = document.createElement('canvas');
    canvas.width = props.width;
    canvas.height = props.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, props.width, props.height);
      const img = canvasRef.current?.getCanvas();
      if (img) {
        ctx.drawImage(img, 0, 0, props.width, props.height);

        // Binary processing
        if (props.maskMode) {
          const imageData = ctx.getImageData(0, 0, props.width, props.height);
          const data = imageData.data;
          const threshold = 128; // Threshold (0-255)
          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3; // Calculate the average value
            const value = avg > threshold ? 255 : 0; // Binary based on the threshold
            data[i] = data[i + 1] = data[i + 2] = value; // Set RGB to the same value
          }
          ctx.putImageData(imageData, 0, 0);
        }

        props.onChange({
          imageBase64: canvas.toDataURL('image/png'),
          foregroundBase64: canvasRef.current?.toDataURL('image/png') || '',
          backgroundColor: bgColor,
        });
      }
    }
  }, [bgColor, props]);

  const [imageBase64, setImageBase64] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];

      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onloadend = (e) => {
        console.log(e);
        const img = new Image();
        img.src = reader.result as string;

        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = props.width;
          canvas.height = props.height;

          // Fit Image
          const imgRatio = img.width / img.height;
          const canvasRatio = canvas.width / canvas.height;
          let width, height;
          if (imgRatio > canvasRatio) {
            width = canvas.width;
            height = canvas.width / imgRatio;
          } else {
            height = canvas.height;
            width = canvas.height * imgRatio;
          }
          const x = (canvas.width - width) / 2;
          const y = (canvas.height - height) / 2;

          ctx?.drawImage(img, x, y, width, height);

          const resizedImageDataUri = canvas.toDataURL(file.type);

          setImageBase64(resizedImageDataUri);
        };
      };
    }
  };
  const onClickUploadComplete = useCallback(() => {
    props.onChange({
      imageBase64: imageBase64,
      foregroundBase64: imageBase64,
      backgroundColor: bgColor,
    });
  }, [imageBase64, bgColor, props]);

  const onClickClear = useCallback(() => {
    canvasRef.current?.clear();
  }, []);

  return (
    <>
      <ModalDialog isOpen={isOpenUpload} title={t('sketch.upload_image')}>
        <div>
          <div className="mb-3 flex w-full">
            <input type="file" onChange={handleImageUpload} accept="image/*" />
          </div>
          <div className="flex w-full justify-center">
            {imageBase64 && <img src={imageBase64} />}
          </div>

          <div className="mt-3 flex w-full justify-end gap-3">
            <Button
              outlined
              onClick={() => {
                setIsOpenUpload(false);
              }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onClickUploadComplete}>
              {t('common.complete')}
            </Button>
          </div>
        </div>
      </ModalDialog>
      <div className="w-full">
        <div className={`m-auto mb-1 flex w-[512px] items-end justify-between`}>
          <div className="flex">
            {!props.maskMode && (
              <SketchButton
                className="relative text-xl"
                onClick={() => {
                  setIsOpenPalette(!isOpenPalette);
                }}>
                <PiPaintBrushFill style={{ color: penColor }} />
              </SketchButton>
            )}
            {isOpenPalette && (
              <CompactPicker
                className="absolute -left-6 top-7 border bg-white"
                color={penColor}
                onChangeComplete={onChangePenColor}
                onChange={onChangePenColor}
              />
            )}

            <SketchButton
              className="relative text-xl"
              onClick={() => {
                setIsOpendotSizeSlider(!isOpendotSizeSlider);
              }}>
              <PiDotBold />
            </SketchButton>
            {isOpendotSizeSlider && (
              <div className="relative">
                <div className="absolute -left-6 top-7 flex flex-row gap-2 border bg-white p-2">
                  <div
                    className="flex items-center justify-center border"
                    style={{ width: '80px', height: '80px' }}>
                    <div
                      className="rounded-full bg-black"
                      style={{ width: dotSize * 2, height: dotSize * 2 }}></div>
                  </div>
                  <RangeSlider
                    className=""
                    label={t('sketch.pen_size')}
                    min={1}
                    max={30}
                    value={dotSize}
                    onChange={(n) => {
                      setDotSize(n);
                    }}
                  />
                </div>
              </div>
            )}

            {!props.maskMode && (
              <SketchButton
                className="relative ml-1 text-xl"
                onClick={() => {
                  setIsOpenPaletteBg(!isOpenPaletteBg);
                }}>
                <PiPaintBucketFill />
              </SketchButton>
            )}
            {isOpenPaletteBg && (
              <CompactPicker
                className="absolute -left-6 top-7 border bg-white"
                color={penColor}
                onChangeComplete={onChangeBgColor}
                onChange={onChangeBgColor}
              />
            )}

            <SketchButton
              className="ml-1 text-xl"
              isActive={isEraseMode}
              onClick={() => {
                setIsEraseMode(!isEraseMode);
              }}>
              <PiEraserFill />
            </SketchButton>

            <SketchButton className="ml-1 text-xl" onClick={onClickUndo}>
              <PiArrowCounterClockwise />
            </SketchButton>
            <SketchButton className="text-xl" onClick={onClickRedo}>
              <PiArrowClockwise />
            </SketchButton>
          </div>

          <Button outlined onClick={onClickClear}>
            <PiTrash className="mr-2" />
            {t('sketch.clear')}
          </Button>
        </div>

        <div className="flex w-full justify-center">
          <SignatureCanvas
            ref={canvasRef}
            canvasProps={{
              width: props.width,
              height: props.height,
              className: 'border',
              style: {
                backgroundColor: bgColor,
                backgroundImage: `url(${props.background?.imageBase64})`,
              },
            }}
            penColor={isEraseMode ? bgColor : penColor}
            dotSize={dotSize}
            maxWidth={dotSize}
            minWidth={dotSize}
          />
        </div>
        <div className="mt-3 flex justify-between">
          <Button
            onClick={() => {
              setIsOpenUpload(true);
            }}>
            <PiUploadSimple />
            {t('sketch.upload_image')}
          </Button>
          <div className="flex gap-3">
            <Button outlined onClick={props.onCancel}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onClickComplete}>{t('common.complete')}</Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SketchPad;
