import { create } from 'zustand';
import { MediaFormat } from '@aws-sdk/client-transcribe';
import useTranscribeApi from './useTranscribeApi';

const useTranscribeState = create<{
  loading: boolean;
  file: File | null;
  setFile: (file: File) => void;
  transcribe: (speakerLabel?: boolean, maxSpakers?: number) => Promise<void>;
  jobName: string | null;
  status: string;
  setStatus: (status: string) => void;
  clear: () => void;
}>((set, get) => {
  const api = useTranscribeApi();

  const setFile = (file: File) => {
    set(() => ({
      file: file,
    }));
  };

  const setStatus = (status: string) => {
    set(() => ({
      status: status,
      loading: status === 'COMPLETED' ? false : true,
    }));
  };

  const clear = () => {
    set(() => ({
      status: '',
      jobName: null,
      file: null,
    }));
  };

  const transcribe = async (speakerLabel = false, maxSpeakers = 1) => {
    set(() => ({
      loading: true,
    }));

    const mediaFormat = get().file?.name.split('.').pop() as MediaFormat;

    // Get the signed URL
    const signedUrlRes = await api.getSignedUrl({
      mediaFormat: mediaFormat,
    });
    const signedUrl = signedUrlRes.data;
    const audioUrl = signedUrl.split(/[?#]/)[0]; // Exclude the query parameters from the signed URL

    // Upload the audio
    await api.uploadAudio(signedUrl, { file: get().file! });

    // Start the transcription
    const startTranscriptionRes = await api.startTranscription({
      audioUrl: audioUrl,
      speakerLabel: speakerLabel,
      maxSpeakers: maxSpeakers,
    });

    set(() => ({
      jobName: startTranscriptionRes.jobName,
    }));
  };

  return {
    file: null,
    loading: false,
    jobName: null,
    status: '',
    clear,
    setFile,
    transcribe,
    setStatus,
  };
});

const useTranscribe = () => {
  const {
    file,
    loading,
    jobName,
    status,
    transcribe,
    setFile,
    setStatus,
    clear,
  } = useTranscribeState();
  const { data: transcriptData } = useTranscribeApi().getTranscription(
    jobName,
    status,
    setStatus
  );
  return {
    loading,
    transcriptData,
    file,
    setFile,
    transcribe,
    clear,
  };
};
export default useTranscribe;
