import {
  ListPollyVoicesResponse,
  SynthesizeSpeechRequest,
  SynthesizeSpeechResponse,
} from 'generative-ai-use-cases';
import useHttp from './useHttp';

const useTextToSpeechApi = () => {
  const http = useHttp();
  return {
    listVoices: (languageCode?: string | null) => {
      // null: do not fetch, undefined: all languages
      const url =
        languageCode === null
          ? null
          : languageCode
            ? `polly/voices?languageCode=${encodeURIComponent(languageCode)}`
            : 'polly/voices';
      return http.get<ListPollyVoicesResponse>(url, {
        revalidateOnFocus: false,
      });
    },
    synthesize: async (
      req: SynthesizeSpeechRequest
    ): Promise<SynthesizeSpeechResponse> => {
      const res = await http.post<
        SynthesizeSpeechResponse,
        SynthesizeSpeechRequest
      >('polly/synthesize', req);
      return res.data;
    },
  };
};

export default useTextToSpeechApi;
