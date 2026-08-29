import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../lambda/deleteMessages';
import { deleteMessagesFrom, findChatById } from '../../lambda/repository';
import { Chat } from 'generative-ai-use-cases';

// Mock the repository
jest.mock('../../lambda/repository');
const mockedDeleteMessagesFrom = deleteMessagesFrom as jest.MockedFunction<
  typeof deleteMessagesFrom
>;
const mockedFindChatById = findChatById as jest.MockedFunction<
  typeof findChatById
>;

// Helper function to create APIGatewayProxyEvent
function createAPIGatewayProxyEvent(
  chatId?: string,
  userId?: string,
  queryStringParameters?: Record<string, string>
): APIGatewayProxyEvent {
  return {
    pathParameters: chatId ? { chatId } : {},
    queryStringParameters: queryStringParameters ?? null,
    requestContext: {
      authorizer: userId
        ? {
            claims: {
              'cognito:username': userId,
            },
          }
        : undefined,
    },
  } as unknown as APIGatewayProxyEvent;
}

const chat: Chat = {
  id: 'user#testUser',
  createdDate: '1234567890',
  chatId: 'chat#chat123',
  usecase: 'test',
  title: 'test',
  updatedDate: '1234567890',
};

describe('deleteMessages Lambda handler', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('deletes the messages from the given createdDate', async () => {
    mockedFindChatById.mockResolvedValue(chat);
    mockedDeleteMessagesFrom.mockResolvedValue(undefined);

    const res = await handler(
      createAPIGatewayProxyEvent('chat123', 'testUser', {
        fromCreatedDate: '1234567891#0',
      })
    );

    expect(res.statusCode).toBe(204);
    expect(mockedDeleteMessagesFrom).toHaveBeenCalledWith(
      'chat123',
      '1234567891#0'
    );
  });

  test('returns 400 when fromCreatedDate is not given', async () => {
    const res = await handler(
      createAPIGatewayProxyEvent('chat123', 'testUser')
    );

    expect(res.statusCode).toBe(400);
    expect(mockedDeleteMessagesFrom).not.toHaveBeenCalled();
  });

  test('returns 403 when the chat belongs to another user', async () => {
    mockedFindChatById.mockResolvedValue(null);

    const res = await handler(
      createAPIGatewayProxyEvent('chat123', 'anotherUser', {
        fromCreatedDate: '1234567891#0',
      })
    );

    expect(res.statusCode).toBe(403);
    expect(mockedDeleteMessagesFrom).not.toHaveBeenCalled();
  });

  test('returns 500 when the repository throws an error', async () => {
    mockedFindChatById.mockResolvedValue(chat);
    mockedDeleteMessagesFrom.mockRejectedValue(new Error('DynamoDB error'));

    const res = await handler(
      createAPIGatewayProxyEvent('chat123', 'testUser', {
        fromCreatedDate: '1234567891#0',
      })
    );

    expect(res.statusCode).toBe(500);
  });
});
