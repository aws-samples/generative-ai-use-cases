import { GenerateImageParams, Model } from 'generative-ai-use-cases';
import useImageApi from './useImageApi';

const useImage = () => {
  const { generateImage } = useImageApi();

  return {
    generate: async (params: GenerateImageParams, model: Model | undefined) => {
      return (
        await generateImage({
          model: model,
          params: {
            ...params,
            stylePreset:
              params.stylePreset === '' ? undefined : params.stylePreset,
            initImage:
              params.initImage === ''
                ? undefined
                : params.initImage?.split(',')[1],
            maskImage:
              params.maskImage === ''
                ? undefined
                : params.maskImage?.split(',')[1],
          },
        })
      ).data;
    },
  };
};

export default useImage;
