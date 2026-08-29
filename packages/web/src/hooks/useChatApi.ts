import {
  PredictRequest,
  PredictResponse,
  CreateChatResponse,
  CreateMessagesRequest,
  CreateMessagesResponse,
  ListChatsResponse,
  ListMessagesResponse,
  PredictTitleRequest,
  PredictTitleResponse,
  FindChatByIdResponse,
  UpdateFeedbackRequest,
  UpdateFeedbackResponse,
  UpdateTitleRequest,
  UpdateTitleResponse,
  WebTextRequest,
  WebTextResponse,
  CreateShareIdResponse,
  FindShareIdResponse,
  GetSharedChatResponse,
  Chat,
} from 'generative-ai-use-cases';
import {
  LambdaClient,
  InvokeWithResponseStreamCommand,
} from '@aws-sdk/client-lambda';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import useHttp from '../hooks/useHttp';
import { decomposeId } from '../utils/ChatUtils';
import { AxiosResponse } from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const useChatApi = () => {
  const http = useHttp();

  return {
    createChat: async (): Promise<CreateChatResponse> => {
      const res = await http.post('chats', {});
      return res.data;
    },
    createMessages: async (
      _chatId: string,
      req: CreateMessagesRequest
    ): Promise<CreateMessagesResponse> => {
      const chatId = decomposeId(_chatId);
      const res = await http.post(`chats/${chatId}/messages`, req);
      return res.data;
    },
    deleteChat: async (chatId: string) => {
      return http.delete<void>(`chats/${chatId}`);
    },
    // Delete the messages whose createdDate is greater than or equal to
    // fromCreatedDate. Used when a message in the middle of the conversation is
    // edited and the following messages are discarded.
    deleteMessagesFrom: async (_chatId: string, fromCreatedDate: string) => {
      const chatId = decomposeId(_chatId);
      return http.delete<void>(
        `chats/${chatId}/messages?fromCreatedDate=${encodeURIComponent(
          fromCreatedDate
        )}`
      );
    },
    deleteAllChats: async (): Promise<void> => {
      let exclusiveStartKey: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const url: string = exclusiveStartKey
          ? `chats?exclusiveStartKey=${exclusiveStartKey}`
          : 'chats';
        const res: AxiosResponse<ListChatsResponse> =
          await http.api.get<ListChatsResponse>(url);
        const chats = res.data.data;

        // Delete all chats in this page
        await Promise.all(
          chats.map((chat: Chat) =>
            http.delete<void>(`chats/${decomposeId(chat.chatId)}`)
          )
        );

        exclusiveStartKey = res.data.lastEvaluatedKey;
        hasMore = !!exclusiveStartKey;
      }
    },
    listChats: () => {
      const getKey = (
        pageIndex: number,
        previousPageData: ListChatsResponse
      ) => {
        if (previousPageData && !previousPageData.lastEvaluatedKey) return null;
        if (pageIndex === 0) return 'chats';
        return `chats?exclusiveStartKey=${previousPageData.lastEvaluatedKey}`;
      };
      return http.getPagination<ListChatsResponse>(getKey, {
        revalidateIfStale: false,
      });
    },
    findChatById: (chatId?: string) => {
      return http.get<FindChatByIdResponse>(chatId ? `chats/${chatId}` : null);
    },
    listMessages: (chatId?: string) => {
      return http.get<ListMessagesResponse>(
        chatId ? `chats/${chatId}/messages` : null
      );
    },
    updateTitle: async (chatId: string, title: string, usecase?: string) => {
      const req: UpdateTitleRequest = {
        title,
        usecase,
      };
      const res = await http.put<UpdateTitleResponse>(
        `chats/${chatId}/title`,
        req
      );
      return res.data;
    },
    updateFeedback: async (
      _chatId: string,
      req: UpdateFeedbackRequest
    ): Promise<UpdateFeedbackResponse> => {
      const chatId = decomposeId(_chatId);
      const res = await http.post(`chats/${chatId}/feedbacks`, req);
      return res.data;
    },
    // Buffered Response (used in useTextToJson)
    predict: async (req: PredictRequest): Promise<string> => {
      const res = await http.post<PredictResponse>('predict', req);
      return res.data;
    },
    // Streaming Response
    predictStream: async function* (
      req: PredictRequest,
      decode: boolean = true
    ) {
      const token = (await fetchAuthSession()).tokens?.idToken?.toString();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const region = import.meta.env.VITE_APP_REGION;
      const userPoolId = import.meta.env.VITE_APP_USER_POOL_ID;
      const idPoolId = import.meta.env.VITE_APP_IDENTITY_POOL_ID;
      const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;
      const lambda = new LambdaClient({
        region,
        requestHandler: {
          requestTimeout: 300000,
          socketTimeout: 300000,
          connectionTimeout: 10000,
        },
        credentials: fromCognitoIdentityPool({
          clientConfig: { region },
          identityPoolId: idPoolId,
          logins: {
            [providerName]: token,
          },
        }),
      });

      // Append idToken to req
      req.idToken = token;

      const payload = JSON.stringify(req);

      // Lambda request payload limit is 6MB (6,291,456 bytes)
      const LAMBDA_PAYLOAD_LIMIT = 6_291_456;
      const payloadSize = new Blob([payload]).size;
      if (payloadSize > LAMBDA_PAYLOAD_LIMIT) {
        const error = new Error(
          `Payload size ${payloadSize} bytes exceeds Lambda limit of ${LAMBDA_PAYLOAD_LIMIT} bytes`
        );
        error.name = 'PayloadTooLargeError';
        throw error;
      }

      const res = await lambda.send(
        new InvokeWithResponseStreamCommand({
          FunctionName: import.meta.env.VITE_APP_PREDICT_STREAM_FUNCTION_ARN,
          Payload: payload,
        })
      );
      const events = res.EventStream!;

      for await (const event of events) {
        if (event.PayloadChunk) {
          if (decode) {
            yield new TextDecoder('utf-8').decode(event.PayloadChunk.Payload);
          } else {
            yield event.PayloadChunk.Payload;
          }
        }

        if (event.InvokeComplete) {
          break;
        }
      }
    },
    predictTitle: async (
      req: PredictTitleRequest
    ): Promise<PredictTitleResponse> => {
      const res = await http.post('predict/title', req);
      return res.data;
    },
    getWebText: async (
      req: WebTextRequest
    ): Promise<AxiosResponse<WebTextResponse>> => {
      return await http.api.get(`web-text?url=${req.url}`);
    },
    createShareId: async (
      chatId: string
    ): Promise<AxiosResponse<CreateShareIdResponse>> => {
      const res = await http.post(`shares/chat/${chatId}`, {});
      return res.data;
    },
    findShareId: (chatId?: string) => {
      return http.get<FindShareIdResponse>(
        chatId ? `/shares/chat/${chatId}` : null
      );
    },
    getSharedChat: (shareId: string) => {
      return http.get<GetSharedChatResponse>(`/shares/share/${shareId}`);
    },
    deleteShareId: (shareId: string) => {
      return http.delete<void>(`/shares/share/${shareId}`);
    },
  };
};

export default useChatApi;
