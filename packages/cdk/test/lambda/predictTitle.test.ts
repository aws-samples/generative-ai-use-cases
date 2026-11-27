import { InvokeParams, invokeHandler } from './api/testApp';
import { Chat } from 'generative-ai-use-cases';
import { findChatById, setChatTitle } from '../../lambda/repository';

jest.mock('../../lambda/repository');
jest.mock('../../lambda/utils/api', () => ({
  __esModule: true,
  default: {
    bedrock: {
      invoke: jest.fn().mockResolvedValue('<output>New title</output>'),
    },
  },
}));
jest.mock('../../lambda/utils/models', () => ({
  defaultModel: { type: 'bedrock', modelId: 'model' },
}));

import { handler } from '../../lambda/predictTitle';

const mockedFindChatById = findChatById as jest.MockedFunction<
  typeof findChatById
>;
const mockedSetChatTitle = setChatTitle as jest.MockedFunction<
  typeof setChatTitle
>;

const aliceChat: Chat = {
  id: 'user#alice',
  createdDate: '100',
  chatId: 'chat#c1',
  usecase: '/chat',
  title: '',
  updatedDate: '100',
};

const event = (userName: string, chat: Partial<Chat>): InvokeParams => ({
  user: userName,
  body: { prompt: 'p', id: '/title', chat },
});

describe('predictTitle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockedFindChatById.mockImplementation(async (user, chatId) =>
      user === 'alice' && chatId === 'c1' ? aliceChat : null
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("writes the title to the caller's own chat", async () => {
    const result = await invokeHandler(handler, event('alice', aliceChat));
    expect(result.statusCode).toBe(200);
    expect(mockedSetChatTitle).toHaveBeenCalledWith(
      'user#alice',
      '100',
      'New title',
      '/chat'
    );
  });

  it('uses the stored record key, not the one in the request', async () => {
    await invokeHandler(
      handler,
      event('alice', { ...aliceChat, id: 'user#bob', createdDate: '999' })
    );
    expect(mockedSetChatTitle).toHaveBeenCalledWith(
      'user#alice',
      '100',
      'New title',
      '/chat'
    );
  });

  it("refuses another user's chat", async () => {
    const result = await invokeHandler(handler, event('bob', aliceChat));
    expect(result.statusCode).toBe(403);
    expect(mockedSetChatTitle).not.toHaveBeenCalled();
  });

  it('refuses a chat that does not exist', async () => {
    const result = await invokeHandler(
      handler,
      event('alice', { ...aliceChat, chatId: 'chat#missing' })
    );
    expect(result.statusCode).toBe(403);
    expect(mockedSetChatTitle).not.toHaveBeenCalled();
  });
});
