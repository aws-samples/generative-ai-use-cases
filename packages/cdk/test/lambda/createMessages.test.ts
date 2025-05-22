import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../lambda/createMessages';
import { batchCreateMessages, findChatById } from '../../lambda/repository';
import { RecordedMessage, ToBeRecordedMessage } from 'generative-ai-use-cases';

// Mock the repository
jest.mock('../../lambda/repository');
const mockedBatchCreateMessages = batchCreateMessages as jest.MockedFunction<
  typeof batchCreateMessages
>;
const mockedFindChatById = findChatById as jest.MockedFunction<
  typeof findChatById
>;

// Mock the environment variable
const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  process.env.BUCKET_NAME = 'test-bucket';
});

afterAll(() => {
  process.env = originalEnv;
});

// Helper function to create APIGatewayProxyEvent
function createAPIGatewayProxyEvent(
  body: unknown | null,
  chatId?: string,
  userId?: string
): APIGatewayProxyEvent {
  return {
    body: body ? JSON.stringify(body) : null,
    pathParameters: chatId ? { chatId } : {},
    requestContext: {
      authorizer: userId
        ? {
            claims: {
              'cognito:username': userId,
            },
          }
        : undefined,
    },
  } as APIGatewayProxyEvent;
}

describe('createMessages Lambda handler', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // Test for successful request
  test('returns correct response for valid request', async () => {
    // Test data
    const messages: ToBeRecordedMessage[] = [
      {
        messageId: 'msg123',
        role: 'user',
        content: 'Hello, world!',
        usecase: 'test',
      },
    ];

    const userId = 'testUser';
    const chatId = 'chat123';

    const expectedRecordedMessages: RecordedMessage[] = [
      {
        id: `chat#${chatId}`,
        createdDate: '1234567890',
        messageId: 'msg123',
        role: 'user',
        content: 'Hello, world!',
        userId: `user#${userId}`,
        feedback: 'none',
        usecase: 'test',
      },
    ];

    // Set up mocks
    mockedFindChatById.mockResolvedValue({
      id: `user#${userId}`,
      createdDate: '1234567890',
      chatId: `chat#${chatId}`,
      usecase: '',
      title: '',
      updatedDate: '',
    });
    mockedBatchCreateMessages.mockResolvedValue(expectedRecordedMessages);

    // Execute test
    const result = await handler(
      createAPIGatewayProxyEvent({ messages }, chatId, userId)
    );

    // Verify results
    expect(result.statusCode).toBe(200);
    expect(mockedFindChatById).toHaveBeenCalledWith(userId, chatId);
    expect(mockedBatchCreateMessages).toHaveBeenCalledWith(
      messages,
      userId,
      chatId
    );
    expect(JSON.parse(result.body)).toEqual({
      messages: expectedRecordedMessages,
    });
  });

  // Test for unauthorized access
  test('returns 403 error when user does not have access to chat', async () => {
    const messages: ToBeRecordedMessage[] = [
      {
        messageId: 'msg123',
        role: 'user',
        content: 'Hello, world!',
        usecase: 'test',
      },
    ];
    const userId = 'testUser';
    const chatId = 'chat123';

    // Set up mock - chat not found
    mockedFindChatById.mockResolvedValue(null);

    // Execute test
    const result = await handler(
      createAPIGatewayProxyEvent({ messages }, chatId, userId)
    );

    // Verify results
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      message: 'You do not have permission to post messages in the chat.',
    });
    expect(mockedBatchCreateMessages).not.toHaveBeenCalled();
  });

  // Test for internal server error
  test('returns 500 error when an exception occurs', async () => {
    const messages: ToBeRecordedMessage[] = [
      {
        messageId: 'msg123',
        role: 'user',
        content: 'Hello, world!',
        usecase: 'test',
      },
    ];
    const userId = 'testUser';
    const chatId = 'chat123';

    // Spy on console.log to avoid cluttering test output
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // Set up mock to throw an error
    mockedFindChatById.mockImplementation(() => {
      throw new Error('Test error');
    });

    // Execute test
    const result = await handler(
      createAPIGatewayProxyEvent({ messages }, chatId, userId)
    );

    // Verify results
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Internal Server Error',
    });
    expect(consoleLogSpy).toHaveBeenCalled();

    // Restore the spy
    consoleLogSpy.mockRestore();
  });
});
