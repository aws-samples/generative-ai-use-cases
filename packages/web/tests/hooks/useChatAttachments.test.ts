import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  PredictRequest,
  RecordedMessage,
  UploadedFileType,
} from 'generative-ai-use-cases';
import useChat from '../../src/hooks/useChat';

// What the hook sends to the predictStream Lambda function
const requests: PredictRequest[] = [];

vi.mock('../../src/hooks/useChatApi', () => ({
  default: () => ({
    // A saved chat with one earlier turn
    listMessages: () => ({
      data: { messages: earlierTurn },
      isLoading: false,
    }),
    findChatById: () => ({
      data: {
        chat: {
          id: 'chat#c1',
          createdDate: '1',
          chatId: 'c1',
          usecase: '/chat',
          title: 't',
          updatedDate: '2',
        },
      },
      isLoading: false,
    }),
    createChat: vi.fn(),
    createMessages: vi.fn(),
    predictTitle: vi.fn(),
    updateFeedback: vi.fn(),
    // Record the request, then end the turn with an error so nothing is saved
    predictStream: async function* (req: PredictRequest) {
      requests.push(req);
      yield new TextEncoder().encode(
        JSON.stringify({ text: '', stopReason: 'error' }) + '\n'
      );
    },
  }),
}));
vi.mock('../../src/hooks/useChatList', () => ({
  default: () => ({ mutate: vi.fn() }),
}));
vi.mock('../../src/hooks/useFileApi', () => ({
  default: () => ({
    getS3Uri: (url: string) =>
      url.replace(/^https:\/\/(.+?)\.s3\..+?\.amazonaws\.com\//, 's3://$1/'),
    isUserFileUrl: (url: string) =>
      /^https:\/\/.+?\.s3\..+?\.amazonaws\.com\/users\//.test(url),
  }),
}));
vi.mock('../../src/hooks/useModel', () => ({
  findModelByModelId: (modelId: string) => ({ type: 'bedrock', modelId }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('i18next', () => ({
  default: { t: (key: string) => key, exists: () => true },
}));

const BUCKET_URL = 'https://file-bucket.s3.ap-northeast-1.amazonaws.com';

const uploaded = (
  name: string,
  type: 'file' | 'image',
  mimeType: string
): UploadedFileType => ({
  id: name,
  file: new File(['x'], name, { type: mimeType }),
  name,
  type,
  mimeType,
  s3Url: `${BUCKET_URL}/users/u1/attachments/uuid/${name}`,
  base64EncodedData: `data:${mimeType};base64,eA==`,
  uploading: false,
  deleting: false,
  errorMessages: [],
});

const earlierTurn: RecordedMessage[] = [
  {
    id: 'chat#c1',
    createdDate: '1',
    messageId: 'm1',
    usecase: '/chat',
    userId: 'user#u1',
    feedback: 'none',
    role: 'user',
    content: 'Summarize this',
    extraData: [
      {
        type: 'file',
        name: 'old.pdf',
        source: {
          type: 's3',
          mediaType: 'application/pdf',
          data: `${BUCKET_URL}/users/u1/attachments/uuid/old.pdf`,
        },
      },
      {
        type: 'video',
        name: 'clip.mp4',
        source: {
          type: 's3',
          mediaType: 'video/mp4',
          data: `${BUCKET_URL}/users/u1/attachments/uuid/clip.mp4`,
        },
      },
      // Saved before the per-user layout: left out, as before
      {
        type: 'image',
        name: 'legacy.png',
        source: {
          type: 's3',
          mediaType: 'image/png',
          data: `${BUCKET_URL}/0b7e5a1c/legacy.png`,
        },
      },
    ],
  },
  {
    id: 'chat#c1',
    createdDate: '2',
    messageId: 'm2',
    usecase: '/chat',
    userId: 'user#u1',
    feedback: 'none',
    role: 'assistant',
    content: 'It is about cats.',
  },
];

describe('useChat attachments (#1334)', () => {
  beforeEach(() => {
    requests.length = 0;
  });

  it('sends the S3 URL of images and documents, not their contents', async () => {
    const { result } = renderHook(() => useChat('/chat/attachments', 'c1'));
    act(() => result.current.setModelId('model-a'));
    expect(result.current.messages).toHaveLength(2);

    const files = [
      uploaded('new.pdf', 'file', 'application/pdf'),
      uploaded('cat.png', 'image', 'image/png'),
    ];
    await act(async () => {
      await result.current.postChat(
        'And this?',
        false,
        undefined,
        undefined,
        undefined,
        files
      );
    });

    expect(requests).toHaveLength(1);
    const sent = requests[0].messages.flatMap((m) => m.extraData ?? []);
    expect(sent).toEqual([
      {
        type: 'file',
        name: 'old.pdf',
        source: {
          type: 's3',
          mediaType: 'application/pdf',
          data: `${BUCKET_URL}/users/u1/attachments/uuid/old.pdf`,
        },
      },
      // Videos keep going to Bedrock as an s3:// location
      {
        type: 'video',
        name: 'clip.mp4',
        source: {
          type: 's3',
          mediaType: 'video/mp4',
          data: 's3://file-bucket/users/u1/attachments/uuid/clip.mp4',
        },
      },
      {
        type: 'file',
        name: 'new.pdf',
        source: {
          type: 's3',
          mediaType: 'application/pdf',
          data: `${BUCKET_URL}/users/u1/attachments/uuid/new.pdf`,
        },
      },
      {
        type: 'image',
        name: 'cat.png',
        source: {
          type: 's3',
          mediaType: 'image/png',
          data: `${BUCKET_URL}/users/u1/attachments/uuid/cat.png`,
        },
      },
    ]);
    expect(JSON.stringify(requests[0])).not.toContain('base64');
  });
});
