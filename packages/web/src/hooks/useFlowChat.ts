import { useState, useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import useFlowApi from './useFlowApi';
import {
  Flow,
  ShownMessage,
  UploadedFileType,
  ExtraData,
} from 'generative-ai-use-cases';
import { MODELS } from './useModel';
import useFileApi from './useFileApi';
import useFiles from './useFiles';

type FlowState = {
  messages: ShownMessage[];
  loading: boolean;
  error: string | null;
  flow: Flow | null;
  base64Cache: Record<string, string>;
  setMessages: (messages: ShownMessage[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFlow: (flow: Flow) => void;
  setBase64Cache: (cache: Record<string, string>) => void;
  clear: () => void;
};

const useFlowStore = create<FlowState>((set) => ({
  base64Cache: {},
  messages: [],
  loading: false,
  error: null,
  flow: null,
  setMessages: (messages: ShownMessage[]) =>
    set(() => ({
      messages: messages,
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setFlow: (flow) => set({ flow }),
  clear: () => set({ messages: [], error: null }),
  setBase64Cache: (cache: Record<string, string>) =>
    set({ base64Cache: cache }),
}));

function parse(content: string) {
  let document;
  try {
    document = JSON.parse(content);
  } catch (e) {
    document = content;
  }
  return document;
}

const useFlowChat = (id: string = '/flow') => {
  const { invokeFlowStream } = useFlowApi();
  const { getS3Uri } = useFileApi();
  const {
    messages,
    loading,
    error,
    flow,
    base64Cache,
    setMessages,
    setLoading,
    setError,
    setFlow,
    setBase64Cache,
    clear,
  } = useFlowStore();
  const { flows } = MODELS;
  const [availableFlows] = useState<Flow[]>(flows);
  const {
    uploadedFiles,
    uploadFiles,
    checkFiles,
    deleteUploadedFile,
    uploading,
    errorMessages,
    base64Cache: filesBase64Cache,
  } = useFiles(id);

  const fileLimit = useMemo(
    () => ({
      maxImageFileCount: 5,
      maxImageFileSizeMB: 5,
      maxVideoFileCount: 0,
      maxVideoFileSizeMB: 0,
      maxFileCount: 0,
      maxFileSizeMB: 0,
      accept: {
        doc: [],
        image: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
        video: [],
      },
    }),
    []
  );

  // convert img to s3 uri
  const convertToS3UriFormat = useCallback(
    (uploadedFiles: UploadedFileType[] | undefined): ExtraData[] => {
      if (!uploadedFiles || uploadedFiles.length === 0) return [];

      return uploadedFiles
        .filter((file) => file.s3Url && !file.uploading)
        .map((file) => ({
          type: file.type,
          name: file.name,
          source: {
            type: 's3',
            mediaType: file.file.type,
            data: getS3Uri(file.s3Url ?? ''),
          },
        }));
    },
    [getS3Uri]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const msgs = messages;

      if (!flow) {
        setError('No Flow selected');
        return;
      }

      // convert img to s3 uri
      const imageExtraData = convertToS3UriFormat(uploadedFiles);

      // renew base64Cache
      setBase64Cache(filesBase64Cache);

      msgs.push({
        id: uuid(),
        role: 'user',
        content,
        extraData: imageExtraData.length > 0 ? imageExtraData : undefined,
      });

      setMessages(msgs);
      setLoading(true);
      setError(null);

      try {
        // If there is an attachment, create an object with the content and file information
        const documentData =
          imageExtraData.length > 0
            ? {
                content,
                files: imageExtraData.map((data) => ({
                  type: data.type,
                  name: data.name,
                  s3Uri: data.source.data,
                })),
              }
            : parse(content);

        const stream = invokeFlowStream({
          flowIdentifier: flow.flowId,
          flowAliasIdentifier: flow.aliasId,
          document: documentData,
        });

        let assistantResponse = '';
        const id = uuid();
        setMessages([
          ...msgs,
          { id, role: 'assistant', content: assistantResponse },
        ]);
        for await (const chunk of stream) {
          assistantResponse += chunk;
          setMessages([
            ...msgs,
            { id, role: 'assistant', content: assistantResponse },
          ]);
        }
      } catch (err) {
        setError('Error invoking Flow');
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [
      setLoading,
      setError,
      invokeFlowStream,
      messages,
      setMessages,
      flow,
      uploadedFiles,
      convertToS3UriFormat,
      filesBase64Cache,
      setBase64Cache,
    ]
  );

  return {
    messages,
    loading,
    error,
    flow,
    availableFlows,
    sendMessage,
    setFlow,
    clear,
    uploadedFiles,
    uploadFiles,
    checkFiles,
    deleteUploadedFile,
    uploading,
    errorMessages,
    fileLimit,
    base64Cache,
  };
};

export default useFlowChat;
