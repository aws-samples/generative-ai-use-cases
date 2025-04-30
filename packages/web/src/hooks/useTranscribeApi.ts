import {
  GetFileUploadSignedUrlRequest,
  StartTranscriptionRequest,
  StartTranscriptionResponse,
  GetTranscriptionResponse,
  UploadAudioRequest,
  GetFileUploadSignedUrlResponse,
} from 'generative-ai-use-cases';
import useHttp from './useHttp';
import axios from 'axios';

const useTranscribeApi = () => {
  const http = useHttp();
  return {
    getSignedUrl: (req: GetFileUploadSignedUrlRequest) => {
      return http.post<GetFileUploadSignedUrlResponse>('transcribe/url', req);
    },
    getTranscription: (
      jobName: string | null,
      status: string,
      setStatus: (status: string) => void
    ) => {
      return http.get<GetTranscriptionResponse>(
        jobName ? `transcribe/result/${jobName}` : null,
        {
          refreshInterval: status === 'COMPLETED' ? 0 : 2000,
          onSuccess: (data: GetTranscriptionResponse) => {
            setStatus(data.status);
          },
        }
      );
    },
    startTranscription: async (
      req: StartTranscriptionRequest
    ): Promise<StartTranscriptionResponse> => {
      const res = await http.post('transcribe/start', req);
      return res.data;
    },
    uploadAudio: (url: string, req: UploadAudioRequest) => {
      return axios({
        method: 'PUT',
        url: url,
        headers: { 'Content-Type': 'audio/*' },
        data: req.file,
      });
    },
  };
};

export default useTranscribeApi;
