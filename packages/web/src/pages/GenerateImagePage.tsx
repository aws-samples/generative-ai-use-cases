import React, { useCallback, useEffect, useState, useMemo } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import Textarea from '../components/Textarea';
import { create } from 'zustand';
import RangeSlider from '../components/RangeSlider';
import Select from '../components/Select';
import ExpandableField from '../components/ExpandableField';
import ButtonIcon from '../components/ButtonIcon';
import { PiFileArrowUp, PiDiceFive, PiNotePencil } from 'react-icons/pi';
import { MdDeleteOutline } from 'react-icons/md';
import useImage from '../hooks/useImage';
import GenerateImageAssistant from '../components/GenerateImageAssistant';
import SketchPad, { Canvas } from '../components/SketchPad';
import ModalDialog from '../components/ModalDialog';
import { produce } from 'immer';
import Help from '../components/Help';
import { useLocation } from 'react-router-dom';
import useChat from '../hooks/useChat';
import Base64Image from '../components/Base64Image';
import { AxiosError } from 'axios';
import { GenerateImagePageQueryParams } from '../@types/navigate';
import { MODELS } from '../hooks/useModel';
import { getPrompter } from '../prompts';
import queryString from 'query-string';
import { GenerateImageParams } from 'generative-ai-use-cases';
import {
  AmazonBaseImageGenerationMode,
  AmazonUIImageGenerationMode,
  ControlMode,
} from 'generative-ai-use-cases';
import InputText from '../components/InputText';
import { useTranslation } from 'react-i18next';

const MAX_SAMPLE = 7;

const AMAZON_MODELS = {
  TITAN_V1: 'amazon.titan-image-generator-v1',
  TITAN_V2: 'amazon.titan-image-generator-v2:0',
  NOVA_CANVAS: 'amazon.nova-canvas-v1:0',
};
const STABILITY_AI_MODELS = {
  STABLE_DIFFUSION_XL: 'stability.stable-diffusion-xl-v1',
  SD3_LARGE: 'stability.sd3-large-v1:0',
  STABLE_IMAGE_CORE1_0: 'stability.stable-image-core-v1:0',
  STABLE_IMAGE_CORE1_1: 'stability.stable-image-core-v1:1',
  STABLE_IMAGE_ULTRA1_0: 'stability.stable-image-ultra-v1:0',
  STABLE_IMAGE_ULTRA1_1: 'stability.stable-image-ultra-v1:1',
  SD3_5: 'stability.sd3-5-large-v1:0',
};
const GENERATION_MODES: Record<
  AmazonBaseImageGenerationMode,
  AmazonBaseImageGenerationMode
> = {
  TEXT_IMAGE: 'TEXT_IMAGE',
  IMAGE_VARIATION: 'IMAGE_VARIATION',
  INPAINTING: 'INPAINTING',
  OUTPAINTING: 'OUTPAINTING',
} as const;
const AMAZON_ADVANCED_GENERATION_MODE: Record<
  AmazonUIImageGenerationMode,
  AmazonUIImageGenerationMode
> = {
  ...GENERATION_MODES,
  IMAGE_CONDITIONING: 'IMAGE_CONDITIONING',
  COLOR_GUIDED_GENERATION: 'COLOR_GUIDED_GENERATION',
  BACKGROUND_REMOVAL: 'BACKGROUND_REMOVAL',
};
type ModelInfo<T extends 'base' | 'advanced'> = {
  supportedModes: T extends 'base'
    ? AmazonBaseImageGenerationMode[]
    : AmazonUIImageGenerationMode[];
  resolutionPresets: { value: string; label: string }[];
};
const defaultModelPresets = [
  { value: '512 x 512', label: '512 x 512' },
  { value: '1024 x 1024', label: '1024 x 1024' },
  { value: '1280 x 768', label: '1280 x 768' },
  { value: '768 x 1280', label: '768 x 1280' },
];
const stabilityAi2024ModelPresets = [
  { value: '1:1', label: '1024 x 1024' },
  { value: '5:4', label: '1088 x 896' },
  { value: '3:2', label: '1216 x 832' },
  { value: '16:9', label: '1344 x 768' },
  { value: '21:9', label: '1536 x 640' },
];
// Add the following image size for Nova Reel 1st frame image generation to Nova Canvas
const novaCanvasPresets = [
  ...defaultModelPresets,
  { value: '1280 x 720', label: '1280 x 720' },
];
const modelInfo: Record<string, ModelInfo<'base' | 'advanced'>> = {
  [STABILITY_AI_MODELS.STABLE_DIFFUSION_XL]: {
    supportedModes: [
      GENERATION_MODES.TEXT_IMAGE,
      GENERATION_MODES.IMAGE_VARIATION,
      GENERATION_MODES.INPAINTING,
      GENERATION_MODES.OUTPAINTING,
    ],
    resolutionPresets: defaultModelPresets,
  },
  [STABILITY_AI_MODELS.SD3_LARGE]: {
    supportedModes: [
      GENERATION_MODES.TEXT_IMAGE,
      GENERATION_MODES.IMAGE_VARIATION,
    ],
    resolutionPresets: stabilityAi2024ModelPresets,
  },
  [STABILITY_AI_MODELS.STABLE_IMAGE_CORE1_0]: {
    supportedModes: [GENERATION_MODES.TEXT_IMAGE],
    resolutionPresets: stabilityAi2024ModelPresets,
  },
  [STABILITY_AI_MODELS.STABLE_IMAGE_CORE1_1]: {
    supportedModes: [GENERATION_MODES.TEXT_IMAGE],
    resolutionPresets: stabilityAi2024ModelPresets,
  },
  [STABILITY_AI_MODELS.STABLE_IMAGE_ULTRA1_0]: {
    supportedModes: [GENERATION_MODES.TEXT_IMAGE],
    resolutionPresets: stabilityAi2024ModelPresets,
  },
  [STABILITY_AI_MODELS.STABLE_IMAGE_ULTRA1_1]: {
    supportedModes: [GENERATION_MODES.TEXT_IMAGE],
    resolutionPresets: stabilityAi2024ModelPresets,
  },
  [STABILITY_AI_MODELS.SD3_5]: {
    supportedModes: [
      GENERATION_MODES.TEXT_IMAGE,
      GENERATION_MODES.IMAGE_VARIATION,
    ],
    resolutionPresets: stabilityAi2024ModelPresets,
  },
  [AMAZON_MODELS.TITAN_V1]: {
    supportedModes: [
      GENERATION_MODES.TEXT_IMAGE,
      GENERATION_MODES.IMAGE_VARIATION,
      GENERATION_MODES.INPAINTING,
      GENERATION_MODES.OUTPAINTING,
    ],
    resolutionPresets: defaultModelPresets,
  },
  [AMAZON_MODELS.TITAN_V2]: {
    supportedModes: [
      AMAZON_ADVANCED_GENERATION_MODE.TEXT_IMAGE,
      AMAZON_ADVANCED_GENERATION_MODE.IMAGE_VARIATION,
      AMAZON_ADVANCED_GENERATION_MODE.INPAINTING,
      AMAZON_ADVANCED_GENERATION_MODE.OUTPAINTING,
      AMAZON_ADVANCED_GENERATION_MODE.IMAGE_CONDITIONING,
      AMAZON_ADVANCED_GENERATION_MODE.COLOR_GUIDED_GENERATION,
      AMAZON_ADVANCED_GENERATION_MODE.BACKGROUND_REMOVAL,
    ],
    resolutionPresets: defaultModelPresets,
  },
  [AMAZON_MODELS.NOVA_CANVAS]: {
    supportedModes: [
      AMAZON_ADVANCED_GENERATION_MODE.TEXT_IMAGE,
      AMAZON_ADVANCED_GENERATION_MODE.IMAGE_VARIATION,
      AMAZON_ADVANCED_GENERATION_MODE.INPAINTING,
      AMAZON_ADVANCED_GENERATION_MODE.OUTPAINTING,
      AMAZON_ADVANCED_GENERATION_MODE.IMAGE_CONDITIONING,
      AMAZON_ADVANCED_GENERATION_MODE.COLOR_GUIDED_GENERATION,
      AMAZON_ADVANCED_GENERATION_MODE.BACKGROUND_REMOVAL,
    ],
    resolutionPresets: novaCanvasPresets,
  },
};

const colorsOptions = [
  {
    value: '#efd9b4,#d6a692,#a39081,#4d6164,#292522',
    label: 'Earthy Neutrals',
  },
  {
    value: '#001449,#012677,#005bc5,#00b4fc,#17f9ff',
    label: 'Ocean Blues',
  },
  {
    value: '#c7003f,#f90050,#f96a00,#faab00,#daf204',
    label: 'Fiery Sunset',
  },
  {
    value: '#ffd100,#ffee32,#ffd100,#00a86b,#004b23',
    label: 'Lemon Lime',
  },
  {
    value: '#006400,#228B22,#32CD32,#90EE90,#98FB98',
    label: 'Forest Greens',
  },
  {
    value: '#4B0082,#8A2BE2,#9370DB,#BA55D3,#DDA0DD',
    label: 'Royal Purples',
  },
  {
    value: '#FF8C00,#FFA500,#FFD700,#FFFF00,#F0E68C',
    label: 'Golden Ambers',
  },
  {
    value: '#FFB6C1,#FFC0CB,#FFE4E1,#E6E6FA,#F0F8FF',
    label: 'Soft Pastels',
  },
  {
    value: '#FF00FF,#00FFFF,#FF0000,#00FF00,#0000FF',
    label: 'Vivid Rainbow',
  },
  {
    value: '#000000,#333333,#666666,#999999,#CCCCCC',
    label: 'Classic Monochrome',
  },
  {
    value: '#FFFFFF,#F2F2F2,#E6E6E6,#D9D9D9,#CCCCCC',
    label: 'Light Grayscale',
  },
  {
    value: '#704214,#8B4513,#A0522D,#CD853F,#DEB887',
    label: 'Vintage Sepia',
  },
  {
    value: '#FF9900,#232F3E,#ffffff,#00464F,#6C7778',
    label: 'Smile and Sky',
  },
];

const getModeOptions = (imageGenModelId: string) => {
  if (imageGenModelId in modelInfo) {
    return modelInfo[imageGenModelId].supportedModes.map((mode) => ({
      value: mode,
      label: mode,
    }));
  } else {
    return [
      {
        value: GENERATION_MODES.TEXT_IMAGE,
        label: GENERATION_MODES.TEXT_IMAGE,
      },
    ];
  }
};
const getResolutionPresets = (imageGenModelId: string) => {
  if (imageGenModelId in modelInfo) {
    return modelInfo[imageGenModelId].resolutionPresets;
  } else {
    return stabilityAi2024ModelPresets;
  }
};

type StateType = {
  imageGenModelId: string;
  setImageGenModelId: (c: string) => void;
  prompt: string;
  setPrompt: (s: string) => void;
  negativePrompt: string;
  setNegativePrompt: (s: string) => void;
  resolution: { value: string; label: string };
  setResolution: (s: { value: string; label: string }) => void;
  resolutionPresets: { value: string; label: string }[];
  stylePreset: string;
  setStylePreset: (s: string) => void;
  seed: number[];
  setSeed: (n: number, idx: number) => void;
  step: number;
  setStep: (n: number) => void;
  cfgScale: number;
  setCfgScale: (n: number) => void;
  imageStrength: number;
  setImageStrength: (n: number) => void;
  controlStrength: number;
  setControlStrength: (n: number) => void;
  controlMode: ControlMode;
  setControlMode: (s: ControlMode) => void;
  generationMode: AmazonUIImageGenerationMode;
  setGenerationMode: (s: AmazonUIImageGenerationMode) => void;
  initImage: Canvas;
  setInitImage: (s: Canvas) => void;
  maskImage: Canvas;
  setMaskImage: (s: Canvas) => void;
  maskPrompt: string;
  setMaskPrompt: (s: string) => void;
  colors: string;
  setColors: (colors: string) => void;
  imageSample: number;
  setImageSample: (n: number) => void;
  image: {
    base64: string;
    error: boolean;
    errorMessage?: string;
  }[];
  clearImage: () => void;
  setImage: (index: number, base64: string) => void;
  setImageError: (index: number, errorMessage: string) => void;
  chatContent: string;
  setChatContent: (s: string) => void;
  clear: () => void;
};

const useGenerateImagePageState = create<StateType>((set, get) => {
  const INIT_STATE = {
    imageGenModelId: '',
    prompt: '',
    negativePrompt: '',
    resolution: {
      value: '',
      label: '',
    },
    resolutionPresets: getResolutionPresets(''),
    stylePreset: '',
    seed: [0, ...new Array(MAX_SAMPLE - 1).fill(-1)],
    step: 50,
    cfgScale: 7,
    imageStrength: 0.35,
    controlStrength: 0.7,
    controlMode: 'CANNY_EDGE' as ControlMode,
    generationMode: 'TEXT_IMAGE' as AmazonUIImageGenerationMode,
    initImage: {
      imageBase64: '',
      foregroundBase64: '',
      backgroundColor: '',
    },
    maskImage: {
      imageBase64: '',
      foregroundBase64: '',
      backgroundColor: '',
    },
    maskPrompt: '',
    colors: colorsOptions[0].value,
    imageSample: 3,
    image: new Array(MAX_SAMPLE).fill({
      base64: '',
      error: false,
    }),
    chatContent: '',
  };

  return {
    ...INIT_STATE,
    setImageGenModelId: (s: string) => {
      const newResolutionPresets = getResolutionPresets(s);
      const newResolution = newResolutionPresets[0];
      const currentMode = get().generationMode;
      const availableModes = modelInfo[s]?.supportedModes || [
        AMAZON_ADVANCED_GENERATION_MODE.TEXT_IMAGE,
      ];
      const isValidMode = availableModes.some((mode) => mode === currentMode);
      set(() => ({
        imageGenModelId: s,
        resolutionPresets: newResolutionPresets,
        resolution: newResolution,
        generationMode: isValidMode ? currentMode : availableModes[0],
      }));
    },
    setPrompt: (s) => {
      set(() => ({
        prompt: s,
      }));
    },
    setNegativePrompt: (s) => {
      set(() => ({
        negativePrompt: s,
      }));
    },
    setResolution: (s) => {
      set(() => ({
        resolution: s,
      }));
    },
    setStylePreset: (s) => {
      set(() => ({
        stylePreset: s,
      }));
    },
    setSeed: (n, idx) => {
      set(() => ({
        seed: produce(get().seed, (draft) => {
          draft[idx] = n;
        }),
      }));
    },
    setStep: (n) => {
      set(() => ({
        step: n,
      }));
    },
    setCfgScale: (n) => {
      set(() => ({
        cfgScale: n,
      }));
    },
    setImageStrength: (n) => {
      set(() => ({
        imageStrength: n,
      }));
    },
    setControlStrength: (n) => {
      set(() => ({
        controlStrength: n,
      }));
    },
    setControlMode: (n) => {
      set(() => ({
        controlMode: n,
      }));
    },
    setGenerationMode: (s) => {
      set(() => ({
        generationMode: s,
      }));
    },
    setInitImage: (s) => {
      set(() => ({
        initImage: s,
      }));
    },
    setMaskImage: (s) => {
      set(() => ({
        maskImage: s,
      }));
    },
    setMaskPrompt: (s) => {
      set(() => ({
        maskPrompt: s,
      }));
    },
    setColors: (s) => {
      set(() => ({
        colors: s,
      }));
    },
    setImageSample: (n) => {
      set(() => ({
        imageSample: n,
      }));
    },
    setImage: (index, base64) => {
      set(() => ({
        image: produce(get().image, (draft) => {
          draft.splice(index, 1, {
            base64,
            error: false,
          });
        }),
      }));
    },
    setImageError: (index, errorMessage) => {
      set(() => ({
        image: produce(get().image, (draft) => {
          draft.splice(index, 1, {
            base64: '',
            error: true,
            errorMessage,
          });
        }),
      }));
    },
    clearImage: () => {
      set(() => ({
        image: [...INIT_STATE.image],
      }));
    },
    setChatContent: (s) => {
      set(() => ({
        chatContent: s,
      }));
    },
    clear: () => {
      set(() => ({
        ...INIT_STATE,
      }));
    },
  };
});

// StylePreset for StableDiffusion
// See the list below for the style_preset
// https://platform.stability.ai/docs/api-reference#tag/v1generation/operation/textToImage
const stylePresetOptions = [
  '3d-model',
  'analog-film',
  'anime',
  'cinematic',
  'comic-book',
  'digital-art',
  'enhance',
  'fantasy-art',
  'isometric',
  'line-art',
  'low-poly',
  'modeling-compound',
  'neon-punk',
  'origami',
  'photographic',
  'pixel-art',
  'tile-texture',
].map((s) => ({
  value: s,
  label: s,
}));

// Control Mode for Image Conditioning when using Titan Image Generator v2
// https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-image.html
const controlModeOptions = ['CANNY_EDGE', 'SEGMENTATION'].map((s) => ({
  value: s as ControlMode,
  label: s as ControlMode,
}));
const GenerateImagePage: React.FC = () => {
  const { t } = useTranslation();
  const {
    imageGenModelId,
    setImageGenModelId,
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    resolution,
    setResolution,
    resolutionPresets,
    stylePreset,
    setStylePreset,
    seed,
    setSeed,
    step,
    setStep,
    cfgScale,
    setCfgScale,
    generationMode,
    setGenerationMode,
    initImage,
    setInitImage,
    maskImage,
    setMaskImage,
    maskPrompt,
    setMaskPrompt,
    colors,
    setColors,
    image,
    setImage,
    setImageError,
    clearImage,
    imageSample,
    setImageSample,
    imageStrength,
    setImageStrength,
    controlStrength,
    setControlStrength,
    controlMode,
    setControlMode,
    chatContent,
    setChatContent,
    clear,
  } = useGenerateImagePageState();

  const { pathname, search } = useLocation();
  const { generate } = useImage();
  const {
    getModelId,
    setModelId,
    loading: loadingChat,
    clear: clearChat,
    updateSystemContextByModel,
  } = useChat(pathname);

  const [generating, setGenerating] = useState(false);
  const [isOpenSketch, setIsOpenSketch] = useState(false);
  const [isOpenMask, setIsOpenMask] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [previousImageSample, setPreviousImageSample] = useState(3);
  const [previousGenerationMode, setPreviousGenerationMode] =
    useState<AmazonUIImageGenerationMode>('TEXT_IMAGE');
  const { modelIds, imageGenModelIds, imageGenModels, modelDisplayName } =
    MODELS;
  const modelId = getModelId();
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);
  const [width, height] = useMemo(() => {
    return resolution.label.split('x').map((v) => Number(v));
  }, [resolution]);
  const [colorList, setColorList] = useState<string[]>(
    colors.split(',').map((color) => color.trim())
  );

  const maskMode = useMemo(() => {
    return (
      generationMode === GENERATION_MODES.INPAINTING ||
      generationMode === GENERATION_MODES.OUTPAINTING
    );
  }, [generationMode]);
  const maskPromptSupported = useMemo(() => {
    // TODO: Remove Hard Coding
    return (
      imageGenModelId === AMAZON_MODELS.TITAN_V1 ||
      imageGenModelId === AMAZON_MODELS.TITAN_V2 ||
      imageGenModelId === AMAZON_MODELS.NOVA_CANVAS
    );
  }, [imageGenModelId]);

  useEffect(() => {
    setPreviousGenerationMode(generationMode);
  }, [generationMode]);

  useEffect(() => {
    if (generationMode === 'BACKGROUND_REMOVAL') {
      setPreviousImageSample(imageSample);
      setImageSample(1);
    } else if (previousGenerationMode === 'BACKGROUND_REMOVAL') {
      setImageSample(previousImageSample);
    }
    // eslint-disable-next-line  react-hooks/exhaustive-deps
  }, [generationMode]);

  const modeOptions = useMemo(
    () => getModeOptions(imageGenModelId),
    [imageGenModelId]
  );
  useEffect(() => {
    const availableModes = getModeOptions(imageGenModelId).map(
      (option) => option.value
    );
    if (!availableModes.includes(generationMode)) {
      setGenerationMode(availableModes[0]);
    }
  }, [imageGenModelId, generationMode, setGenerationMode]);

  useEffect(() => {
    updateSystemContextByModel();
    // eslint-disable-next-line  react-hooks/exhaustive-deps
  }, [prompter]);

  // Setting the demo data for LandingPage
  useEffect(() => {
    const _modelId = !modelId ? modelIds[0] : modelId;
    const _imageGenModelId = !imageGenModelId
      ? imageGenModelIds[0]
      : imageGenModelId;

    if (search !== '') {
      const params = queryString.parse(search) as GenerateImagePageQueryParams;
      setChatContent(params.content ?? '');
      setModelId(
        modelIds.includes(params.modelId ?? '') ? params.modelId! : _modelId
      );
      setImageGenModelId(
        imageGenModelIds.includes(params.imageModelId ?? '')
          ? params.imageModelId!
          : _imageGenModelId
      );
    } else {
      setModelId(_modelId);
      setImageGenModelId(_imageGenModelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    imageGenModelId,
    imageGenModelIds,
    modelId,
    modelIds,
    search,
    setChatContent,
    setImageGenModelId,
  ]);

  const generateRandomSeed = useCallback(() => {
    return Math.floor(Math.random() * 4294967295);
  }, []);

  const generateImage = useCallback(
    async (_prompt: string, _negativePrompt: string, _stylePreset?: string) => {
      clearImage();
      setGenerating(true);

      const modelConfig = modelInfo[imageGenModelId];
      if (!modelConfig) {
        console.error(`Unknown model: ${imageGenModelId}`);
        setGenerating(false);
        return;
      }

      const promises = new Array(imageSample).fill('').map((_, idx) => {
        let _seed = seed[idx];
        if (_seed < 0) {
          const rand = generateRandomSeed();
          setSeed(rand, idx);
          _seed = rand;
        }

        let params: GenerateImageParams = {
          textPrompt: [
            {
              text: _prompt,
              weight: 1,
            },
            {
              text: _negativePrompt,
              weight: -1,
            },
          ],
          width: width,
          height: height,
          cfgScale,
          seed: _seed,
          step,
          stylePreset: _stylePreset ?? stylePreset,
          taskType:
            generationMode === 'IMAGE_CONDITIONING'
              ? 'TEXT_IMAGE'
              : generationMode,
        };

        if (generationMode === GENERATION_MODES.IMAGE_VARIATION) {
          params = {
            ...params,
            initImage: initImage.imageBase64,
            imageStrength,
          };
        } else if (
          generationMode === GENERATION_MODES.INPAINTING ||
          generationMode === GENERATION_MODES.OUTPAINTING
        ) {
          params = {
            ...params,
            initImage: initImage.imageBase64,
            maskPrompt: maskImage.imageBase64 ? undefined : maskPrompt,
            maskImage: maskImage.imageBase64,
          };
        } else if (
          generationMode === AMAZON_ADVANCED_GENERATION_MODE.IMAGE_CONDITIONING
        ) {
          params = {
            ...params,
            initImage: initImage.imageBase64,
            controlStrength,
            controlMode,
          };
        } else if (
          generationMode ===
          AMAZON_ADVANCED_GENERATION_MODE.COLOR_GUIDED_GENERATION
        ) {
          params = {
            ...params,
            initImage: initImage.imageBase64,
            colors: colors.split(',').map((color) => color.trim()),
          };
        } else if (
          generationMode === AMAZON_ADVANCED_GENERATION_MODE.BACKGROUND_REMOVAL
        ) {
          params = {
            ...params,
            initImage: initImage.imageBase64,
          };
        }

        // Setting the resolution
        if (modelConfig.resolutionPresets[0].value.includes(':')) {
          params = {
            ...params,
            aspectRatio: resolution.value,
          };
        }

        return generate(
          params,
          imageGenModels.find((m) => m.modelId === imageGenModelId)
        )
          .then((res) => {
            setImage(idx, res);
          })
          .catch((e: AxiosError<{ message: string }>) => {
            console.log(e);
            setImageError(idx, e.response?.data.message ?? e.message);
          });
      });

      await Promise.all(promises).finally(() => {
        setGenerating(false);
      });
    },
    [
      imageGenModels,
      imageGenModelId,
      cfgScale,
      clearImage,
      generate,
      generateRandomSeed,
      width,
      height,
      imageSample,
      imageStrength,
      generationMode,
      initImage,
      maskPrompt,
      maskImage,
      colors,
      seed,
      setImage,
      setImageError,
      setSeed,
      step,
      stylePreset,
      resolution.value,
      controlMode,
      controlStrength,
    ]
  );

  const isImageVariationSupported = useMemo(() => {
    const availableModes = getModeOptions(imageGenModelId).map(
      (option) => option.value
    );
    return availableModes.includes(GENERATION_MODES.IMAGE_VARIATION);
  }, [imageGenModelId]);

  const onClickRandomSeed = useCallback(() => {
    setSeed(generateRandomSeed(), selectedImageIndex);
  }, [generateRandomSeed, selectedImageIndex, setSeed]);

  const onChangeInitImageBase64 = useCallback(
    (s: Canvas) => {
      setInitImage(s);
      setIsOpenSketch(false);
    },
    [setInitImage]
  );

  const onChangeMaskImageBase64 = useCallback(
    (s: Canvas) => {
      setMaskImage(s);
      setIsOpenMask(false);
    },
    [setMaskImage]
  );

  const onSelectImage = useCallback(
    (idx: number) => {
      if (seed[idx] < 0) {
        setSeed(generateRandomSeed(), idx);
      }
      setSelectedImageIndex(idx);
    },
    [generateRandomSeed, seed, setSeed]
  );

  const generateImageVariant = useCallback(() => {
    if (image[selectedImageIndex].base64) {
      if (generationMode === GENERATION_MODES.TEXT_IMAGE) {
        setGenerationMode(GENERATION_MODES.IMAGE_VARIATION);
      }
      const img = `data:image/png;base64,${image[selectedImageIndex].base64}`;
      setInitImage({
        imageBase64: img,
        foregroundBase64: img,
        backgroundColor: '',
      });
      setDetailExpanded(true);
    }
  }, [
    image,
    generationMode,
    selectedImageIndex,
    setGenerationMode,
    setInitImage,
    setDetailExpanded,
  ]);

  const clearAll = useCallback(() => {
    setSelectedImageIndex(0);
    clear();
    clearChat();
  }, [clear, clearChat]);

  const downloadFileName = useMemo(() => {
    return prompt.toLowerCase().replace(/ /g, '-').replace(/,/g, '_');
  }, [prompt]);

  return (
    <div className="grid h-screen grid-cols-12 gap-4 p-4">
      <ModalDialog
        isOpen={isOpenSketch}
        title={t('generateImage.init_image')}
        className="w-[530px]"
        help={t('generateImage.help.init_image')}
        onClose={() => {
          setIsOpenSketch(false);
        }}>
        <SketchPad
          width={width}
          height={height}
          image={initImage}
          onChange={onChangeInitImageBase64}
          onCancel={() => {
            setIsOpenSketch(false);
          }}
        />
      </ModalDialog>
      <ModalDialog
        isOpen={isOpenMask}
        title={t('generateImage.mask_image')}
        className="w-[530px]"
        help={t('generateImage.help.mask_image')}
        onClose={() => {
          setIsOpenMask(false);
        }}>
        <SketchPad
          width={width}
          height={height}
          image={maskImage}
          background={initImage}
          maskMode={true}
          onChange={onChangeMaskImageBase64}
          onCancel={() => {
            setIsOpenMask(false);
          }}
        />
      </ModalDialog>

      <div className="col-span-12 h-[calc(100vh-2rem)] lg:col-span-6">
        <GenerateImageAssistant
          modelId={modelId}
          onChangeModel={setModelId}
          modelIds={modelIds}
          content={chatContent}
          onChangeContent={setChatContent}
          isGeneratingImage={generating}
          onGenerate={async (p, np, sp) => {
            // Generate only if there is a change in the settings
            if (
              p !== prompt ||
              np !== negativePrompt ||
              (sp ?? '') !== stylePreset
            ) {
              setSelectedImageIndex(0);
              setPrompt(p);
              setNegativePrompt(np);
              if (sp !== undefined) {
                setStylePreset(sp);
              }
              return generateImage(p, np, sp);
            }
          }}
        />
      </div>

      <div className="col-span-12 lg:col-span-6">
        <Card className="lg:min-h-[calc(100vh-2rem)]">
          <div className="flex items-center justify-center">
            <Base64Image
              className="min-h-60 min-w-60 max-w-lg"
              imageBase64={image[selectedImageIndex].base64}
              loading={generating}
              error={image[selectedImageIndex].error}
              errorMessage={image[selectedImageIndex].errorMessage}
              downloadFileName={downloadFileName}
            />
          </div>

          <div className="mb-2 flex flex-row justify-center gap-x-2">
            {image.map((image, idx) => (
              <React.Fragment key={idx}>
                {idx < imageSample && (
                  <Base64Image
                    className={`${
                      idx === selectedImageIndex ? 'ring-1' : ''
                    } mt-3 size-10`}
                    imageBase64={image.base64}
                    loading={generating}
                    clickable
                    error={image.error}
                    onClick={() => {
                      onSelectImage(idx);
                    }}
                  />
                )}
              </React.Fragment>
            ))}
            <Button
              title="Generate Variant"
              outlined
              className="mt-3 size-10"
              disabled={
                !image[selectedImageIndex].base64 || !isImageVariationSupported
              }
              onClick={generateImageVariant}>
              <PiNotePencil></PiNotePencil>
            </Button>
          </div>
          {generationMode !== 'BACKGROUND_REMOVAL' && (
            <>
              <Textarea
                label={t('generateImage.prompt')}
                help={t('generateImage.help.prompt')}
                value={prompt}
                onChange={setPrompt}
                maxHeight={60}
                rows={2}
              />
              <Textarea
                label={t('generateImage.negative_prompt')}
                help={t('generateImage.help.negative_prompt')}
                value={negativePrompt}
                onChange={setNegativePrompt}
                maxHeight={60}
                rows={2}
              />
            </>
          )}

          <div className="grid w-full grid-cols-2 gap-2">
            <Select
              label={t('generateImage.model')}
              value={imageGenModelId}
              onChange={setImageGenModelId}
              options={imageGenModelIds.map((m) => {
                return { value: m, label: modelDisplayName(m) };
              })}
              fullWidth
            />
            {generationMode !== 'BACKGROUND_REMOVAL' && (
              <Select
                label={t('generateImage.resolution')}
                value={resolution.value}
                onChange={(value: string) => {
                  const selectedResolution = resolutionPresets.find(
                    (option: StateType['resolution']) => option.value === value
                  );
                  if (selectedResolution) {
                    setResolution(selectedResolution);
                  }
                }}
                options={resolutionPresets}
                fullWidth
              />
            )}
          </div>

          {generationMode !== 'BACKGROUND_REMOVAL' && (
            <div className="grid w-full grid-cols-2 gap-2 pt-4">
              <div className="relative col-span-2 flex flex-row items-center lg:col-span-1">
                <RangeSlider
                  className="w-full"
                  label={t('generateImage.seed')}
                  min={0}
                  max={4294967295}
                  value={seed[selectedImageIndex]}
                  onChange={(n) => {
                    setSeed(n, selectedImageIndex);
                  }}
                  help={t('generateImage.help.seed')}
                />
                <ButtonIcon
                  className="absolute -top-0.5 right-[8.2rem]"
                  onClick={onClickRandomSeed}>
                  <PiDiceFive />
                </ButtonIcon>
              </div>

              <RangeSlider
                className="col-span-2 lg:col-span-1"
                label={t('generateImage.image_samples')}
                min={1}
                max={7}
                value={imageSample}
                onChange={setImageSample}
                help={t('generateImage.help.image_samples')}
              />
            </div>
          )}

          <ExpandableField
            label={t('generateImage.detail_parameters')}
            overrideExpanded={detailExpanded}
            setOverrideExpanded={setDetailExpanded}>
            <div className="grid grid-cols-2 gap-2 pt-4">
              <div className="col-span-2 flex flex-col items-stretch justify-start lg:col-span-1">
                <Select
                  label={t('generateImage.generation_mode')}
                  options={modeOptions}
                  value={generationMode}
                  onChange={(v) =>
                    setGenerationMode(v as AmazonUIImageGenerationMode)
                  }
                  fullWidth
                  help={t('generateImage.help.generation_mode')}
                />
                <div className="mb-2 flex flex-row justify-center gap-2 lg:flex-col xl:flex-row">
                  {generationMode !== GENERATION_MODES.TEXT_IMAGE && (
                    <div className="flex flex-col items-center">
                      <div className="mb-1 flex items-center text-sm font-bold">
                        {t('generateImage.init_image')}
                        <Help
                          className="ml-1"
                          position="center"
                          message={t('generateImage.help.init_image')}
                        />
                      </div>
                      <Base64Image
                        className="size-32"
                        imageBase64={initImage.imageBase64}
                      />
                      <Button
                        className="m-auto mt-2 text-sm"
                        onClick={() => {
                          setIsOpenSketch(true);
                        }}>
                        <PiFileArrowUp className="mr-2" />
                        {t('generateImage.set')}
                      </Button>
                    </div>
                  )}
                  {maskMode && (
                    <div className="flex flex-col items-center">
                      <div className="mb-1 flex items-center text-sm font-bold">
                        {t('generateImage.mask_image')}
                        <Help
                          className="ml-1"
                          position="center"
                          message={t('generateImage.help.mask_image')}
                        />
                      </div>
                      <Base64Image
                        className="size-32"
                        imageBase64={maskImage.imageBase64}
                      />
                      <Button
                        className="m-auto mt-2 text-sm"
                        disabled={!!maskPrompt}
                        onClick={() => {
                          setIsOpenMask(true);
                        }}>
                        <PiFileArrowUp className="mr-2" />
                        {t('generateImage.set')}
                      </Button>
                    </div>
                  )}
                </div>
                {maskMode && maskPromptSupported && (
                  <Textarea
                    label={t('generateImage.mask_prompt')}
                    help={t('generateImage.help.mask_prompt')}
                    value={maskPrompt}
                    onChange={setMaskPrompt}
                    maxHeight={60}
                    rows={2}
                    className="w-full"
                    disabled={!!maskImage.imageBase64}
                  />
                )}
                {generationMode === 'COLOR_GUIDED_GENERATION' && (
                  <div className="space-y-4">
                    <div>
                      <Select
                        label={t('generateImage.colors')}
                        help={t('generateImage.help.colors')}
                        options={colorsOptions}
                        value={
                          colorsOptions.find(
                            (option) => option.value === colors
                          )?.value || ''
                        }
                        onChange={(value) => {
                          const newColors = value
                            .split(',')
                            .map((color) => color.trim());
                          setColorList(newColors);
                          setColors(value);
                        }}
                        fullWidth
                        showColorChips
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold">
                        {t('generateImage.custom_colors')}
                      </label>
                      <div className="mt-2 space-y-2">
                        {colorList.map((color, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => {
                                const newColors = [...colorList];
                                newColors[index] = e.target.value;
                                setColorList(newColors);
                                setColors(newColors.join(','));
                              }}
                              className="h-8 w-8 bg-white"
                            />
                            <InputText
                              value={color}
                              onChange={(value) => {
                                const newColors = [...colorList];
                                newColors[index] = value;
                                setColorList(newColors);
                                setColors(newColors.join(','));
                              }}
                              className="w-24"
                            />
                            <ButtonIcon
                              onClick={() => {
                                const newColors = colorList.filter(
                                  (_, i) => i !== index
                                );
                                setColorList(newColors);
                                setColors(newColors.join(','));
                              }}>
                              <MdDeleteOutline />
                            </ButtonIcon>
                          </div>
                        ))}

                        <Button
                          onClick={() => {
                            const newColors = [...colorList, '#000000'];
                            setColorList(newColors);
                            setColors(newColors.join(','));
                          }}
                          className="mt-2"
                          disabled={colorList.length >= 5}>
                          {t('generateImage.add_color')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {generationMode === 'IMAGE_CONDITIONING' && (
                  <Select
                    label={t('generateImage.control_mode')}
                    help={t('generateImage.help.control_mode')}
                    options={controlModeOptions}
                    value={controlMode}
                    onChange={(v) => setControlMode(v as ControlMode)}
                    fullWidth
                  />
                )}
              </div>

              {generationMode !== 'BACKGROUND_REMOVAL' && (
                <div className="col-span-2 flex flex-col items-center justify-start lg:col-span-1">
                  <div className="mb-2 w-full">
                    <Select
                      label={t('generateImage.style_preset')}
                      options={stylePresetOptions}
                      value={stylePreset}
                      onChange={setStylePreset}
                      clearable
                      fullWidth
                    />
                  </div>

                  <RangeSlider
                    className="w-full"
                    label={t('generateImage.cfg_scale')}
                    min={0}
                    max={30}
                    value={cfgScale}
                    onChange={setCfgScale}
                    help={t('generateImage.help.cfg_scale')}
                  />

                  <RangeSlider
                    className="w-full"
                    label={t('generateImage.steps')}
                    min={10}
                    max={50}
                    value={step}
                    onChange={setStep}
                    help={t('generateImage.help.steps')}
                  />

                  {generationMode === GENERATION_MODES.IMAGE_VARIATION && (
                    <RangeSlider
                      className="w-full"
                      label={t('generateImage.image_strength')}
                      min={0}
                      max={1}
                      step={0.01}
                      value={imageStrength}
                      onChange={setImageStrength}
                      help={t('generateImage.help.image_strength')}
                    />
                  )}
                  {generationMode === 'IMAGE_CONDITIONING' && (
                    <RangeSlider
                      className="w-full"
                      label={t('generateImage.control_strength')}
                      min={0}
                      max={1}
                      step={0.01}
                      value={controlStrength}
                      onChange={setControlStrength}
                      help={t('generateImage.help.control_strength')}
                    />
                  )}
                </div>
              )}
            </div>
          </ExpandableField>

          <div className="flex flex-row items-center gap-x-5">
            <Button
              className="h-8 w-full"
              onClick={() => {
                setSelectedImageIndex(0);
                generateImage(prompt, negativePrompt);
              }}
              loading={generating || loadingChat}
              disabled={
                (generationMode !==
                  AMAZON_ADVANCED_GENERATION_MODE.BACKGROUND_REMOVAL &&
                  prompt.length === 0) ||
                (generationMode !== GENERATION_MODES.TEXT_IMAGE &&
                  generationMode !==
                    AMAZON_ADVANCED_GENERATION_MODE.COLOR_GUIDED_GENERATION &&
                  !initImage.imageBase64) ||
                ((generationMode === GENERATION_MODES.INPAINTING ||
                  generationMode === GENERATION_MODES.OUTPAINTING) &&
                  !maskImage.imageBase64 &&
                  !maskPrompt) ||
                (generationMode ===
                  AMAZON_ADVANCED_GENERATION_MODE.COLOR_GUIDED_GENERATION &&
                  !colors)
              }>
              {t('generateImage.generate')}
            </Button>

            <Button
              className="h-8 w-full"
              outlined
              onClick={() => {
                clearAll();
              }}
              disabled={generating || loadingChat}>
              {t('generateImage.clear')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default GenerateImagePage;
